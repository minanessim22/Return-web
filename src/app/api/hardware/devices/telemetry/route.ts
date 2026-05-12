import { apiError, apiJson, readJsonBody } from '@/lib/server/http';
import { addDeviceLocation, createNotification, readStore, updateStore } from '@/lib/server/store';
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
  const tokenHash = hashValue(deviceToken);
  const store = await readStore();
  const requestedDeviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  const device = store.devices.find((item) => item.hardwareBridge?.ready && item.hardwareBridge?.tokenHash === tokenHash && (!requestedDeviceId || item.id === requestedDeviceId));
  if (!device) {
    return apiError(401, 'Invalid hardware token.');
  }
  if (!device.supportsGps) {
    return apiError(409, 'This hardware model does not support GPS telemetry.');
  }

  const latitude = toOptionalNumber(body.latitude);
  const longitude = toOptionalNumber(body.longitude);
  if (latitude === undefined || longitude === undefined) {
    return apiError(400, 'latitude and longitude are required.');
  }

  const accuracyMeters = toOptionalNumber(body.accuracyMeters);
  const batteryLevel = toOptionalNumber(body.batteryLevel);
  const locationText = typeof body.locationText === 'string' ? sanitizePlainText(body.locationText) : undefined;

  const now = new Date().toISOString();
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
        gpsIngressPath: '/api/hardware/devices/telemetry',
        headerName: 'x-device-token'
      };
    }
    draftDevice.hardwareBridge.ready = true;
    draftDevice.hardwareBridge.lastSeenAt = now;
    draftDevice.hardwareBridge.lastEventAt = now;
    draftDevice.hardwareBridge.gpsIngressPath = '/api/hardware/devices/telemetry';
    draftDevice.updatedAt = now;
    draftDevice.trackingEnabled = true;
    if (batteryLevel !== undefined) {
      draftDevice.batteryLevel = Math.max(0, Math.min(100, Math.round(batteryLevel)));
    }
    addDeviceLocation(draft, draftDevice.id, {
      latitude,
      longitude,
      accuracyMeters,
      address: locationText || draftDevice.lastLocationText,
      source: 'gps_hardware'
    });
    if (draftDevice.linkedProfileId) {
      const profile = draft.identificationProfiles.find((item) => item.id === draftDevice.linkedProfileId);
      if (profile) {
        createNotification(
          draft,
          profile.ownerUserId,
          'GPS location updated',
          `${profile.displayName}'s hardware sent a live GPS update.`,
          'gps_telemetry',
          undefined,
          draftDevice.hardwareBridge?.publicUrl || `/identify/${profile.qrPublicToken}`
        );
      }
    }
  });

  const refreshed = (await readStore()).devices.find((item) => item.id === device.id);
  return apiJson({
    success: true,
    item: refreshed,
    telemetryPath: '/api/hardware/devices/telemetry',
    publicBaseUrl: publicBaseUrl(request)
  });
}
