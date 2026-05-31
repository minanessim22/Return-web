import { apiError, apiJson, readJsonBody } from '@/lib/server/http';
import { hashValue, publicBaseUrl, sanitizePlainText } from '@/lib/server/security';
import { prisma } from '@/lib/server/db';

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
  const requestedDeviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';

  try {
    const devices = await prisma.device.findMany({
      include: {
        links: {
          where: { unlinkedAt: null },
          include: { profile: true }
        }
      }
    });

    const device = devices.find((item: any) => {
      const bridge = item.hardwareBridge;
      return (
        bridge &&
        typeof bridge === 'object' &&
        bridge.ready &&
        bridge.tokenHash === tokenHash &&
        (!requestedDeviceId || item.id === requestedDeviceId)
      );
    }) as any;

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
    const bridge = (device.hardwareBridge as any) || {};
    bridge.ready = true;
    bridge.lastSeenAt = now;
    bridge.lastEventAt = now;
    bridge.gpsIngressPath = '/api/hardware/devices/telemetry';

    // Update device fields
    await prisma.device.update({
      where: { id: device.id },
      data: {
        batteryLevel: batteryLevel !== undefined ? Math.max(0, Math.min(100, Math.round(batteryLevel))) : undefined,
        trackingEnabled: true,
        hardwareBridge: bridge
      }
    });

    // Create GpsLocation
    await prisma.gpsLocation.create({
      data: {
        deviceId: device.id,
        latitude,
        longitude,
        recordedAt: new Date()
      }
    });

    // Create LocationHistory
    await prisma.locationHistory.create({
      data: {
        deviceId: device.serialNumber,
        lat: latitude,
        lon: longitude,
        battery: batteryLevel ? Math.round(batteryLevel) : null,
        accuracy: accuracyMeters ?? null,
        recordedAt: new Date(),
        source: 'gps_hardware'
      }
    });

    const profile = device.links?.[0]?.profile;
    if (profile && profile.ownerUserId) {
      await prisma.notification.create({
        data: {
          userId: profile.ownerUserId,
          title: 'GPS location updated',
          body: `${profile.displayName}'s hardware sent a live GPS update.`,
          type: 'gps_telemetry'
        }
      });
    }

    const refreshed = await prisma.device.findUnique({
      where: { id: device.id }
    });

    return apiJson({
      success: true,
      item: refreshed,
      telemetryPath: '/api/hardware/devices/telemetry',
      publicBaseUrl: publicBaseUrl(request)
    });
  } catch (err) {
    console.error('[Telemetry] Error logging hardware location:', err);
    return apiError(500, 'Database error logging telemetry.');
  }
}
