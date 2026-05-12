import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { addDeviceLocation, createNotification, readStore, updateStore } from '@/lib/server/store';
import { ensureSameOrigin } from '@/lib/server/security';
import { capabilitiesFromDevice, resolveHardwareModelKey } from '@/lib/device-models';
import type { DeviceStatus } from '@/lib/shared-types';

export const runtime = 'nodejs';

const DEVICE_STATUSES: DeviceStatus[] = ['ACTIVE', 'PAUSED', 'DISCONNECTED', 'LOW_BATTERY', 'INACTIVE'];

function toOptionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function PATCH(request: Request, context: { params: Promise<{ deviceId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { deviceId } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    await updateStore((store) => {
      const device = store.devices.find((item) => item.id === deviceId);
      if (!device) {
        throw new Error('NOT_FOUND');
      }
      if (device.ownerUserId !== user.id) {
        throw new Error('FORBIDDEN');
      }

      const linkedProfileId = typeof body.linkedProfileId === 'string' && body.linkedProfileId.trim() ? body.linkedProfileId.trim() : undefined;
      if (linkedProfileId) {
        const linkedProfile = store.identificationProfiles.find((item) => item.id === linkedProfileId && item.ownerUserId === user.id);
        if (!linkedProfile) {
          throw new Error('PROFILE_NOT_FOUND');
        }
        device.linkedProfileId = linkedProfileId;
      } else if (body.linkedProfileId === null || body.linkedProfileId === '') {
        device.linkedProfileId = undefined;
      }

      if (typeof body.label === 'string' && body.label.trim()) {
        device.label = body.label.trim();
      }
      if (DEVICE_STATUSES.includes(body.status)) {
        device.status = body.status;
      }
      const hardwareModel = resolveHardwareModelKey(body.hardwareModel);
      const capabilityPreset = capabilitiesFromDevice({ hardwareModel, type: device.type, supportsNfc: body.supportsNfc, supportsBarcode: body.supportsBarcode, supportsGps: body.supportsGps });
      if (hardwareModel !== 'STANDALONE' || body.hardwareModel === 'STANDALONE') {
        device.hardwareModel = hardwareModel;
        device.supportsNfc = capabilityPreset.supportsNfc;
        device.supportsBarcode = capabilityPreset.supportsBarcode;
        device.supportsGps = capabilityPreset.supportsGps;
      }
      if (typeof body.trackingEnabled === 'boolean') {
        device.trackingEnabled = body.trackingEnabled;
      } else if (device.trackingEnabled === undefined && device.supportsGps) {
        device.trackingEnabled = capabilityPreset.defaultTracking;
      }

      const updateIntervalMinutes = toOptionalNumber(body.updateIntervalMinutes);
      if (updateIntervalMinutes !== undefined) {
        device.updateIntervalMinutes = Math.max(1, Math.min(1440, Math.round(updateIntervalMinutes)));
      } else if (!device.updateIntervalMinutes) {
        device.updateIntervalMinutes = capabilityPreset.defaultIntervalMinutes;
      }

      const batteryLevel = toOptionalNumber(body.batteryLevel);
      if (batteryLevel !== undefined) {
        device.batteryLevel = Math.max(0, Math.min(100, Math.round(batteryLevel)));
      }

      const latitude = toOptionalNumber(body.latitude);
      const longitude = toOptionalNumber(body.longitude);
      const lastLocationText = typeof body.lastLocationText === 'string' ? body.lastLocationText.trim() : undefined;
      if (lastLocationText !== undefined) {
        device.lastLocationText = lastLocationText || undefined;
      }

      if (latitude !== undefined && longitude !== undefined) {
        addDeviceLocation(store, device.id, {
          latitude,
          longitude,
          address: lastLocationText || device.lastLocationText,
          source: 'manual_update'
        });
      }

      device.updatedAt = new Date().toISOString();

      createNotification(
        store,
        user.id,
        'Device updated',
        `${device.label} was updated successfully.`,
        'device',
        undefined,
        '/devices'
      );
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        PROFILE_NOT_FOUND: 400
      };
      if (statusMap[error.message]) {
        return NextResponse.json({ error: error.message }, { status: statusMap[error.message] });
      }
    }
    throw error;
  }

  const store = await readStore();
  const item = store.devices.find((entry) => entry.id === deviceId && entry.ownerUserId === user.id);
  return NextResponse.json({ item });
}


export async function DELETE(request: Request, context: { params: Promise<{ deviceId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { deviceId } = await context.params;

  try {
    await updateStore((store) => {
      const index = store.devices.findIndex((item) => item.id === deviceId);
      if (index === -1) {
        throw new Error('NOT_FOUND');
      }
      const device = store.devices[index];
      if (device.ownerUserId !== user.id) {
        throw new Error('FORBIDDEN');
      }

      store.devices.splice(index, 1);
      createNotification(store, user.id, 'Device removed', `${device.label} was deleted from your devices.`, 'device', undefined, '/devices');
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        FORBIDDEN: 403
      };
      if (statusMap[error.message]) {
        return NextResponse.json({ error: error.message }, { status: statusMap[error.message] });
      }
    }
    throw error;
  }

  return NextResponse.json({ success: true, deviceId });
}
