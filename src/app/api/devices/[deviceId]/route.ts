import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin } from '@/lib/server/security';
import { capabilitiesFromDevice, resolveHardwareModelKey } from '@/lib/device-models';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

const DEVICE_STATUSES = ['ACTIVE', 'PAUSED', 'DISCONNECTED', 'LOW_BATTERY', 'INACTIVE'];

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
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (device.ownerUserId !== user.id) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const linkedProfileId = typeof body.linkedProfileId === 'string' && body.linkedProfileId.trim() ? body.linkedProfileId.trim() : undefined;
    if (linkedProfileId) {
      const profile = await prisma.identificationProfile.findFirst({
        where: { id: linkedProfileId, ownerUserId: user.id }
      });
      if (!profile) {
        return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 400 });
      }
      
      // Update links
      await prisma.deviceLink.deleteMany({ where: { deviceId } });
      await prisma.deviceLink.create({
        data: { deviceId, profileId: linkedProfileId }
      });
    } else if (body.linkedProfileId === null || body.linkedProfileId === '') {
      await prisma.deviceLink.deleteMany({ where: { deviceId } });
    }

    const updateData: any = {};

    if (typeof body.label === 'string' && body.label.trim()) {
      updateData.label = body.label.trim();
    }
    if (DEVICE_STATUSES.includes(body.status)) {
      updateData.status = body.status;
    }

    const hardwareModel = resolveHardwareModelKey(body.hardwareModel);
    const capabilityPreset = capabilitiesFromDevice({
      hardwareModel,
      type: device.type,
      supportsNfc: body.supportsNfc,
      supportsBarcode: body.supportsBarcode,
      supportsGps: body.supportsGps
    });

    if (hardwareModel !== 'STANDALONE' || body.hardwareModel === 'STANDALONE') {
      updateData.hardwareModel = hardwareModel;
      updateData.supportsNfc = capabilityPreset.supportsNfc;
      updateData.supportsBarcode = capabilityPreset.supportsBarcode;
      updateData.supportsGps = capabilityPreset.supportsGps;
    }

    if (typeof body.trackingEnabled === 'boolean') {
      updateData.trackingEnabled = body.trackingEnabled;
    }

    const updateIntervalMinutes = toOptionalNumber(body.updateIntervalMinutes);
    if (updateIntervalMinutes !== undefined) {
      updateData.updateIntervalMinutes = Math.max(1, Math.min(1440, Math.round(updateIntervalMinutes)));
    }

    const batteryLevel = toOptionalNumber(body.batteryLevel);
    if (batteryLevel !== undefined) {
      updateData.batteryLevel = Math.max(0, Math.min(100, Math.round(batteryLevel)));
    }

    const latitude = toOptionalNumber(body.latitude);
    const longitude = toOptionalNumber(body.longitude);
    const lastLocationText = typeof body.lastLocationText === 'string' ? body.lastLocationText.trim() : undefined;

    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: updateData
    });

    if (latitude !== undefined && longitude !== undefined) {
      await prisma.gpsLocation.create({
        data: {
          deviceId,
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
          source: 'manual_update'
        }
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Device updated',
        body: `${updatedDevice.label} was updated successfully.`,
        type: 'device'
      }
    });

    // Get current link
    const activeLink = await prisma.deviceLink.findFirst({
      where: { deviceId, unlinkedAt: null }
    });

    const latestLoc = await prisma.gpsLocation.findFirst({
      where: { deviceId },
      orderBy: { recordedAt: 'desc' }
    });

    const item = {
      ...updatedDevice,
      linkedProfileId: activeLink?.profileId || undefined,
      latitude: latestLoc?.latitude || undefined,
      longitude: latestLoc?.longitude || undefined,
      locationHistory: [],
      links: [],
      notifications: [],
      hardwareBridge: updatedDevice.hardwareBridge || {},
      createdAt: updatedDevice.createdAt.toISOString(),
      updatedAt: updatedDevice.updatedAt.toISOString()
    };

    return NextResponse.json({ item });
  } catch (error) {
    console.error('[DevicePatch] Error:', error);
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
  }
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
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (device.ownerUserId !== user.id) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // Delete device (cascade deletes locations and links)
    await prisma.device.delete({
      where: { id: deviceId }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Device removed',
        body: `${device.label} was deleted from your devices.`,
        type: 'device'
      }
    });

    return NextResponse.json({ success: true, deviceId });
  } catch (error) {
    console.error('[DeviceDelete] Error:', error);
    return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 });
  }
}
