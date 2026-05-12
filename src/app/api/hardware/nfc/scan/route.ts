import { apiError, apiJson, readJsonBody } from '@/lib/server/http';
import { addDeviceLocation, createNotification, readStore, recordProfileScan, updateStore } from '@/lib/server/store';
import { hashValue, publicBaseUrl, sanitizePlainText } from '@/lib/server/security';

export const runtime = 'nodejs';

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
  const store = await readStore();
  const device = store.devices.find((item) => item.type === 'NFC' && item.supportsNfc !== false && item.hardwareBridge?.ready && item.hardwareBridge?.tokenHash === tokenHash);
  if (!device) {
    return apiError(401, 'Invalid hardware token.');
  }
  if (!device.linkedProfileId) {
    return apiError(409, 'This NFC device is not linked to an identification profile yet.');
  }

  const profile = store.identificationProfiles.find((item) => item.id === device.linkedProfileId && item.ownerUserId === device.ownerUserId);
  if (!profile) {
    return apiError(404, 'Linked identification profile was not found.');
  }

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

  await updateStore((draft) => {
    const draftDevice = draft.devices.find((item) => item.id === device.id);
    if (!draftDevice) {
      throw new Error('DEVICE_NOT_FOUND');
    }
    if (!draftDevice.hardwareBridge) {
      draftDevice.hardwareBridge = {
        ready: true,
        protocol: 'HTTP',
        ingressPath: '/api/hardware/nfc/scan',
        headerName: 'x-device-token',
        gpsIngressPath: draftDevice.supportsGps ? '/api/hardware/devices/telemetry' : undefined
      };
    }

    const now = new Date().toISOString();
    draftDevice.hardwareBridge.ready = true;
    draftDevice.hardwareBridge.protocol = 'HTTP';
    draftDevice.hardwareBridge.ingressPath = '/api/hardware/nfc/scan';
    draftDevice.hardwareBridge.headerName = 'x-device-token';
    draftDevice.hardwareBridge.gpsIngressPath = draftDevice.supportsGps ? '/api/hardware/devices/telemetry' : undefined;
    draftDevice.hardwareBridge.lastSeenAt = now;
    draftDevice.hardwareBridge.lastEventAt = now;
    draftDevice.hardwareBridge.lastTagUid = nfcTagUid;
    draftDevice.updatedAt = now;

    if (batteryLevel !== undefined) {
      draftDevice.batteryLevel = Math.max(0, Math.min(100, Math.round(batteryLevel)));
    }

    if (latitude !== undefined && longitude !== undefined) {
      addDeviceLocation(draft, draftDevice.id, {
        latitude,
        longitude,
        address: locationText || draftDevice.lastLocationText,
        source: 'nfc_hardware'
      });
    }

    recordProfileScan(draft, {
      profileId: profile.id,
      type: 'NFC',
      rawValue,
      finderName: typeof body.readerLabel === 'string' ? sanitizePlainText(body.readerLabel) : 'NFC hardware reader',
      latitude,
      longitude,
      locationText
    });

    createNotification(
      draft,
      profile.ownerUserId,
      'NFC tag scanned',
      `${profile.displayName}'s NFC hardware reported a live scan event.`,
      'nfc_scan',
      undefined,
      `/identify/${profile.qrPublicToken}`
    );
  });

  return apiJson({
    success: true,
    item: profile,
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
