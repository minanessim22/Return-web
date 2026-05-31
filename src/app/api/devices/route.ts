import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin, hashValue } from '@/lib/server/security';
import { capabilitiesFromDevice, resolveHardwareModelKey } from '@/lib/device-models';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

const DEVICE_TYPES = ['GPS', 'QR', 'NFC'];

function toOptionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const dbDevices = await prisma.device.findMany({
      where: { ownerUserId: user.id },
      include: {
        links: {
          where: { unlinkedAt: null },
          include: { profile: true }
        },
        gpsLocations: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const trackers = await prisma.registeredTracker.findMany({
      where: {
        ownerEmail: {
          equals: user.email?.trim().toLowerCase(),
          mode: 'insensitive'
        }
      }
    });

    const formattedDevices = dbDevices.map((d: any) => {
      const latestLoc = d.gpsLocations?.[0];
      return {
        id: d.id,
        serialNumber: d.serialNumber,
        label: d.label,
        name: d.label,
        type: d.type,
        status: d.status,
        hardwareModel: d.hardwareModel,
        supportsNfc: d.supportsNfc,
        supportsBarcode: d.supportsBarcode,
        supportsGps: d.supportsGps,
        batteryLevel: d.batteryLevel ?? undefined,
        updateIntervalMinutes: d.updateIntervalMinutes ?? undefined,
        trackingEnabled: d.trackingEnabled,
        linkedProfileId: d.links?.[0]?.profileId || undefined,
        latitude: latestLoc?.latitude || undefined,
        longitude: latestLoc?.longitude || undefined,
        locationHistory: [],
        links: [],
        notifications: [],
        hardwareBridge: d.hardwareBridge || {},
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString()
      };
    });

    const deviceSerials = new Set(formattedDevices.map((d) => d.serialNumber));

    const sqlDevices = trackers
      .filter((t) => t.deviceId && !deviceSerials.has(t.deviceId))
      .map((tracker) => ({
        id: tracker.deviceId,
        serialNumber: tracker.deviceId,
        label: tracker.label || tracker.deviceId,
        name: tracker.label || tracker.deviceId,
        type: 'GPS',
        status: 'ACTIVE',
        hardwareModel: 'STANDALONE',
        supportsNfc: false,
        supportsBarcode: false,
        supportsGps: true,
        trackingEnabled: true,
        locationHistory: [],
        links: [],
        notifications: [],
        hardwareBridge: {},
        createdAt: tracker.createdAt.toISOString(),
        updatedAt: tracker.updatedAt.toISOString()
      }));

    const merged = [...formattedDevices, ...sqlDevices];

    // Sort latest first
    merged.sort((a, b) => {
      const left = a.updatedAt || a.createdAt || '';
      const right = b.updatedAt || b.createdAt || '';
      return left < right ? 1 : -1;
    });

    return NextResponse.json({ items: merged });
  } catch (err) {
    console.error('[DevicesGet] Error retrieving devices:', err);
    return NextResponse.json({ error: 'Failed to retrieve devices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedType = DEVICE_TYPES.includes(body.type) ? body.type : undefined;
  const hardwareModel = resolveHardwareModelKey(body.hardwareModel);
  const capabilityPreset = capabilitiesFromDevice({ hardwareModel, type: requestedType });
  const type = requestedType || capabilityPreset.primaryType;
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const serialNumber = typeof body.serialNumber === 'string' && body.serialNumber.trim() ? body.serialNumber.trim() : undefined;
  const linkedProfileId = typeof body.linkedProfileId === 'string' && body.linkedProfileId.trim() ? body.linkedProfileId.trim() : undefined;
  const trackingEnabled = typeof body.trackingEnabled === 'boolean' ? body.trackingEnabled : capabilityPreset.defaultTracking;
  const updateIntervalMinutes = toOptionalNumber(body.updateIntervalMinutes) ?? capabilityPreset.defaultIntervalMinutes;
  const latitude = toOptionalNumber(body.latitude);
  const longitude = toOptionalNumber(body.longitude);
  const lastLocationText = typeof body.lastLocationText === 'string' ? body.lastLocationText.trim() : undefined;

  if (!type) {
    return NextResponse.json({ error: 'A valid device type is required.' }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: 'Device label is required.' }, { status: 400 });
  }

  try {
    if (linkedProfileId) {
      const profile = await prisma.identificationProfile.findFirst({
        where: { id: linkedProfileId, ownerUserId: user.id }
      });
      if (!profile) {
        return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 400 });
      }
    }

    const serial = serialNumber || `${type}-${randomBytes(3).toString('hex').toUpperCase()}`;

    // Verify serial uniqueness
    const existingSerial = await prisma.device.findUnique({
      where: { serialNumber: serial }
    });
    if (existingSerial) {
      return NextResponse.json({ error: 'Device with this serial number already exists.' }, { status: 400 });
    }

    const hardwareToken = (capabilityPreset.supportsNfc || capabilityPreset.supportsGps) ? randomBytes(18).toString('hex').toUpperCase() : '';
    const hardwareBridge = hardwareToken
      ? {
          ready: true,
          protocol: 'HTTP',
          ingressPath: capabilityPreset.supportsNfc ? '/api/hardware/nfc/scan' : '/api/hardware/devices/telemetry',
          gpsIngressPath: capabilityPreset.supportsGps ? '/api/hardware/devices/telemetry' : undefined,
          headerName: 'x-device-token',
          tokenHash: hashValue(hardwareToken),
          tokenPreview: `${hardwareToken.slice(0, 6)}...${hardwareToken.slice(-4)}`,
          tokenIssuedAt: new Date().toISOString()
        }
      : undefined;

    // Create device
    const device = await prisma.device.create({
      data: {
        ownerUserId: user.id,
        type: type as any,
        hardwareModel,
        supportsNfc: capabilityPreset.supportsNfc,
        supportsBarcode: capabilityPreset.supportsBarcode,
        supportsGps: capabilityPreset.supportsGps,
        serialNumber: serial,
        label,
        status: 'ACTIVE',
        trackingEnabled,
        updateIntervalMinutes,
        hardwareBridge: hardwareBridge ? (hardwareBridge as any) : undefined
      }
    });

    if (latitude !== undefined && longitude !== undefined) {
      await prisma.gpsLocation.create({
        data: {
          deviceId: device.id,
          latitude,
          longitude,
          recordedAt: new Date()
        }
      });

      await prisma.locationHistory.create({
        data: {
          deviceId: device.serialNumber,
          lat: latitude,
          lon: longitude,
          recordedAt: new Date(),
          source: 'manual_setup'
        }
      });
    }

    if (linkedProfileId) {
      await prisma.deviceLink.create({
        data: {
          deviceId: device.id,
          profileId: linkedProfileId
        }
      });
    }

    // Create notification in database
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Device saved',
        body: `${device.label} is now connected to your account.`,
        type: 'device'
      }
    });

    // Format output
    const result = {
      ...device,
      linkedProfileId,
      latitude,
      longitude,
      locationHistory: [],
      links: [],
      notifications: [],
      hardwareBridge: device.hardwareBridge || {},
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
      hardwareBridgeRawToken: hardwareToken || undefined // Pass back for user setup
    };

    return NextResponse.json({ item: result });
  } catch (error) {
    console.error('[DeviceCreate] Error:', error);
    return NextResponse.json({ error: 'Failed to create device' }, { status: 500 });
  }
}
