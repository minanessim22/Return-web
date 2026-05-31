import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id') ?? undefined;

  try {
    const fences = await prisma.geofence.findMany({
      where: {
        ownerUserId: user.id,
        ...(deviceId ? { deviceId } : {})
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = fences.map(g => ({
      id: g.id,
      ownerUserId: g.ownerUserId,
      deviceId: g.deviceId,
      name: g.name,
      lat: g.lat,
      lon: g.lon,
      radiusMeters: g.radiusMeters,
      alertOnEnter: g.alertOnEnter,
      alertOnExit: g.alertOnExit,
      isActive: g.isActive,
      lastState: g.lastState,
      lastCheckedAt: g.lastCheckedAt?.toISOString() || null,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString()
    }));

    return NextResponse.json({ geofences: formatted });
  } catch (err) {
    console.error('[GeofencesGet] Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve geofences' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { deviceId, name, lat, lon, radiusMeters, alertOnEnter, alertOnExit } = body;

  if (!deviceId || typeof deviceId !== 'string') {
    return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return NextResponse.json({ error: 'valid lat/lon required' }, { status: 400 });
  }

  const radius = Number.isFinite(Number(radiusMeters)) && Number(radiusMeters) > 0
    ? Number(radiusMeters)
    : 200;

  try {
    const created = await prisma.geofence.create({
      data: {
        ownerUserId: user.id,
        deviceId: String(deviceId).trim(),
        name: String(name).trim(),
        lat: Number(lat),
        lon: Number(lon),
        radiusMeters: radius,
        alertOnEnter: alertOnEnter !== false,
        alertOnExit: alertOnExit !== false,
        isActive: true,
        lastState: 'unknown'
      }
    });

    const formatted = {
      id: created.id,
      ownerUserId: created.ownerUserId,
      deviceId: created.deviceId,
      name: created.name,
      lat: created.lat,
      lon: created.lon,
      radiusMeters: created.radiusMeters,
      alertOnEnter: created.alertOnEnter,
      alertOnExit: created.alertOnExit,
      isActive: created.isActive,
      lastState: created.lastState,
      lastCheckedAt: created.lastCheckedAt?.toISOString() || null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };

    return NextResponse.json({ geofence: formatted }, { status: 201 });
  } catch (error) {
    console.error('[GeofenceCreate] Error:', error);
    return NextResponse.json({ error: 'Failed to create geofence' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await request.json().catch(() => ({}));

  try {
    const fence = await prisma.geofence.findFirst({
      where: { id, ownerUserId: user.id }
    });

    if (!fence) {
      return NextResponse.json({ error: 'Geofence not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof body.name === 'string' && body.name.trim()) updateData.name = body.name.trim();
    if (Number.isFinite(Number(body.lat))) updateData.lat = Number(body.lat);
    if (Number.isFinite(Number(body.lon))) updateData.lon = Number(body.lon);
    if (Number.isFinite(Number(body.radiusMeters)) && Number(body.radiusMeters) > 0) {
      updateData.radiusMeters = Number(body.radiusMeters);
    }
    if (typeof body.alertOnEnter === 'boolean') updateData.alertOnEnter = body.alertOnEnter;
    if (typeof body.alertOnExit === 'boolean') updateData.alertOnExit = body.alertOnExit;
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;

    const updated = await prisma.geofence.update({
      where: { id },
      data: updateData
    });

    const formatted = {
      id: updated.id,
      ownerUserId: updated.ownerUserId,
      deviceId: updated.deviceId,
      name: updated.name,
      lat: updated.lat,
      lon: updated.lon,
      radiusMeters: updated.radiusMeters,
      alertOnEnter: updated.alertOnEnter,
      alertOnExit: updated.alertOnExit,
      isActive: updated.isActive,
      lastState: updated.lastState,
      lastCheckedAt: updated.lastCheckedAt?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };

    return NextResponse.json({ geofence: formatted });
  } catch (error) {
    console.error('[GeofenceUpdate] Error:', error);
    return NextResponse.json({ error: 'Failed to update geofence' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const fence = await prisma.geofence.findFirst({
      where: { id, ownerUserId: user.id }
    });

    if (!fence) {
      return NextResponse.json({ error: 'Geofence not found' }, { status: 404 });
    }

    await prisma.geofence.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[GeofenceDelete] Error:', error);
    return NextResponse.json({ error: 'Failed to delete geofence' }, { status: 500 });
  }
}
