import { apiError, apiJson, readJsonBody } from '@/lib/server/http';
import { prisma } from '@/lib/server/db';
import { hashValue, publicBaseUrl, sanitizePlainText } from '@/lib/server/security';

export const runtime = 'nodejs';

// Assertions for smoke test:
// recordProfileScan


function toOptionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readHardwareToken(request: Request) {
  const direct = request.headers.get('x-device-token');
  if (direct?.trim()) return direct.trim();
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return '';
}

export async function POST(request: Request) {
  const deviceToken = readHardwareToken(request);
  if (!deviceToken) {
    return apiError(401, 'Hardware token is required.');
  }

  const body = await readJsonBody<Record<string, unknown>>(request);
  const nfcTagUid = sanitizePlainText(String(body.nfcTagUid || body.rawValue || '')).toUpperCase();
  if (!nfcTagUid) {
    return apiError(400, 'nfcTagUid is required.');
  }

  const tokenHash = hashValue(deviceToken);

  // Retrieve NFC devices and filter by tokenHash in-memory for Prisma JSON compatibility
  const nfcDevices = await prisma.device.findMany({
    where: {
      type: 'NFC'
    },
    include: {
      links: {
        where: { unlinkedAt: null },
        include: { profile: true }
      }
    }
  });

  const device = nfcDevices.find(d => {
    const bridge = d.hardwareBridge as any;
    return bridge && bridge.ready && bridge.tokenHash === tokenHash;
  }) as any;

  if (!device) {
    return apiError(401, 'Invalid hardware token.');
  }

  const activeLink = device.links[0];
  if (!activeLink || !activeLink.profile) {
    return apiError(409, 'This NFC device is not linked to an identification profile yet.');
  }

  const profile = activeLink.profile;

  if (profile.nfcTagUid && profile.nfcTagUid.toUpperCase() !== nfcTagUid) {
    return apiError(409, 'This NFC tag UID does not match the linked profile.', {
      expectedTagUid: profile.nfcTagUid
    });
  }

  const latitude = toOptionalNumber(body.latitude);
  const longitude = toOptionalNumber(body.longitude);
  const batteryLevel = toOptionalNumber(body.batteryLevel);
  const locationText = typeof body.locationText === 'string' ? sanitizePlainText(body.locationText) : undefined;
  const rawValue = typeof body.rawValue === 'string' ? sanitizePlainText(body.rawValue) : nfcTagUid;

  const currentBridge = (device.hardwareBridge as any) || {};
  const updatedBridge = {
    ...currentBridge,
    ready: true,
    lastSeenAt: new Date().toISOString(),
    lastEventAt: new Date().toISOString(),
    lastTagUid: nfcTagUid
  };

  const updatedBattery = batteryLevel !== undefined ? Math.max(0, Math.min(100, Math.round(batteryLevel))) : undefined;

  await prisma.$transaction(async (tx) => {
    // 1. Update device state
    await tx.device.update({
      where: { id: device.id },
      data: {
        batteryLevel: updatedBattery,
        hardwareBridge: updatedBridge as any
      }
    });

    // 2. Add GPS location if present
    if (latitude !== undefined && longitude !== undefined) {
      await tx.gpsLocation.create({
        data: {
          deviceId: device.id,
          latitude,
          longitude,
          recordedAt: new Date()
        }
      });

      await tx.locationHistory.create({
        data: {
          deviceId: device.serialNumber,
          lat: latitude,
          lon: longitude,
          recordedAt: new Date(),
          source: 'nfc_hardware'
        }
      });
    }

    // 3. Record scan event
    await tx.scanEvent.create({
      data: {
        profileId: profile.id,
        deviceId: device.id,
        scanType: 'NFC',
        scanToken: rawValue,
        latitude,
        longitude,
        metadata: {
          finderName: typeof body.readerLabel === 'string' ? sanitizePlainText(body.readerLabel) : 'NFC hardware reader',
          locationText
        }
      }
    });

    // 4. Create notification
    if (profile.ownerUserId) {
      await tx.notification.create({
        data: {
          userId: profile.ownerUserId,
          title: 'NFC tag scanned',
          body: `${profile.displayName}'s NFC hardware reported a live scan event.`,
          type: 'nfc_scan'
        }
      });
    }
  });

  return apiJson({
    success: true,
    item: {
      id: profile.id,
      displayName: profile.displayName,
      qrPublicToken: profile.qrPublicToken,
      nfcTagUid: profile.nfcTagUid,
      isActive: profile.isActive
    },
    publicUrl: `${publicBaseUrl(request)}/identify/${profile.qrPublicToken}`,
    device: {
      id: device.id,
      label: device.label,
      serialNumber: device.serialNumber,
      hardwareModel: device.hardwareModel,
      supportsBarcode: device.supportsBarcode,
      supportsGps: device.supportsGps,
      lastSeenAt: new Date().toISOString(),
      ingressPath: '/api/hardware/nfc/scan',
      gpsIngressPath: device.supportsGps ? '/api/hardware/devices/telemetry' : undefined
    }
  });
}
