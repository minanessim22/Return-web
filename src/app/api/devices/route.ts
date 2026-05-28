import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { addDeviceLocation, createNotification, createOrUpdateDevice, readStore, updateStore } from '@/lib/server/store';
import { ensureSameOrigin, hashValue, publicBaseUrl } from '@/lib/server/security';
import { capabilitiesFromDevice, resolveHardwareModelKey } from '@/lib/device-models';
import type { DeviceType, DeviceItem } from '@/lib/shared-types';
import { listRegisteredTrackersForEmail } from '@/lib/server/sqlite-db';

export const runtime = 'nodejs';

const DEVICE_TYPES: DeviceType[] = ['GPS', 'QR', 'NFC'];

function toOptionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 }
    );
  }

  const normalizedEmail = user.email?.trim().toLowerCase();

  const store = await readStore();

  // Existing JSON devices
  const jsonDevices = store.devices
    .filter((item) => item.ownerUserId === user.id)
    .filter(
      (item) =>
        item.type === 'GPS' ||
        item.type === 'QR' ||
        item.type === 'NFC'
    );

  // SQL RegisteredTrackers
  const trackers = normalizedEmail
    ? await listRegisteredTrackersForEmail(normalizedEmail)
    : [];

  const jsonDeviceMap = new Map(
    jsonDevices.map((d) => [
      d.serialNumber || d.id,
      d
    ])
  );

  const sqlDevices = trackers
    .filter((tracker) => tracker.device_id)
    .map((tracker) => {
      // Try matching existing JSON device
      const existing = jsonDeviceMap.get(tracker.device_id);

      if (existing) {
        return existing;
      }

      // Create normalized frontend-compatible device
      return {
        id: tracker.device_id,
        serialNumber: tracker.device_id,
        label: tracker.label || tracker.device_id,
        name: tracker.label || tracker.device_id,
        type: 'GPS',
        ownerUserId: user.id,
        trackingEnabled: true,
        status: 'ACTIVE',
        locationHistory: [],
        createdAt: tracker.created_at,
        updatedAt:
          tracker.updated_at ||
          tracker.created_at ||
          new Date().toISOString()
      } as DeviceItem;
    });

  // Merge + dedupe
  const merged = [...jsonDevices];

  for (const device of sqlDevices) {
    const exists = merged.some((item) => {
      const sameId =
        item.id &&
        device.id &&
        item.id === device.id;

      const sameSerial =
        item.serialNumber &&
        device.serialNumber &&
        item.serialNumber === device.serialNumber;

      return sameId || sameSerial;
    });

    if (!exists) {
      merged.push(device);
    }
  }

  // Sort latest first
  merged.sort((a, b) => {
    const left = a.updatedAt || a.createdAt || '';
    const right = b.updatedAt || b.createdAt || '';
    return left < right ? 1 : -1;
  });

  return NextResponse.json({
    items: merged
  });
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
  const serialNumber = typeof body.serialNumber === 'string' ? body.serialNumber.trim() : undefined;
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

  let savedDeviceId = '';
  const baseUrl = publicBaseUrl(request);

  try {
    await updateStore((store) => {
      if (linkedProfileId) {
        const linkedProfile = store.identificationProfiles.find((item) => item.id === linkedProfileId && item.ownerUserId === user.id);
        if (!linkedProfile) {
          throw new Error('PROFILE_NOT_FOUND');
        }
      }

      const hardwareToken = (capabilityPreset.supportsNfc || capabilityPreset.supportsGps) ? randomBytes(18).toString('hex').toUpperCase() : '';
      const item = createOrUpdateDevice(store, {
        ownerUserId: user.id,
        type,
        hardwareModel,
        supportsNfc: capabilityPreset.supportsNfc,
        supportsBarcode: capabilityPreset.supportsBarcode,
        supportsGps: capabilityPreset.supportsGps,
        serialNumber,
        label,
        linkedProfileId,
        trackingEnabled,
        updateIntervalMinutes,
        latitude,
        longitude,
        lastLocationText,
        hardwareBridge: hardwareToken
          ? {
              ready: true,
              protocol: 'HTTP',
              ingressPath: capabilityPreset.supportsNfc ? '/api/hardware/nfc/scan' : '/api/hardware/devices/telemetry',
              gpsIngressPath: capabilityPreset.supportsGps ? '/api/hardware/devices/telemetry' : undefined,
              publicUrl: linkedProfileId ? `${baseUrl}/identify/${store.identificationProfiles.find((entry) => entry.id === linkedProfileId)?.qrPublicToken || ''}` : undefined,
              headerName: 'x-device-token',
              tokenHash: hashValue(hardwareToken),
              tokenPreview: `${hardwareToken.slice(0, 6)}...${hardwareToken.slice(-4)}`,
              tokenIssuedAt: new Date().toISOString()
            }
          : undefined
      });

      if (latitude !== undefined && longitude !== undefined) {
        addDeviceLocation(store, item.id, {
          latitude,
          longitude,
          address: lastLocationText,
          source: 'manual_setup'
        });
      }

      createNotification(
        store,
        user.id,
        'Device saved',
        `${item.label} is now connected to your account.`,
        'device',
        undefined,
        '/devices'
      );

      savedDeviceId = item.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROFILE_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const store = await readStore();
  const item = store.devices.find((entry) => entry.id === savedDeviceId && entry.ownerUserId === user.id);
  return NextResponse.json({ item });
}
