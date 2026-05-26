/**
 * /api/tracker/geofences
 * ─────────────────────────────────────────────────────────────────
 * CRUD for Geofences (Virtual boundaries / السياج الجغرافي)
 *
 * GET    /api/tracker/geofences?device_id=colota01
 *   → List all geofences for a device owned by the current user
 *
 * POST   /api/tracker/geofences
 *   Body: { deviceId, name, lat, lon, radiusMeters, alertOnEnter, alertOnExit }
 *   → Create a new geofence
 *
 * DELETE /api/tracker/geofences?id=geo_xxx
 *   → Delete a geofence
 *
 * PATCH  /api/tracker/geofences?id=geo_xxx
 *   Body: partial Geofence fields
 *   → Update a geofence (toggle active, change radius, etc.)
 * ─────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { readStore, updateStore } from '@/lib/server/store';
import type { Geofence } from '@/lib/shared-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ── GET – list geofences ───────────────────────────────────────────

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id') ?? undefined;

  const store = await readStore();
  const fences = store.geofences.filter((g) => {
    if (g.ownerUserId !== user.id) return false;
    if (deviceId && g.deviceId !== deviceId) return false;
    return true;
  });

  return NextResponse.json({ geofences: fences });
}

// ── POST – create geofence ─────────────────────────────────────────

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

  let created: Geofence | null = null;

  await updateStore((store) => {
    const now = new Date().toISOString();
    created = {
      id: createId('geo'),
      ownerUserId: user.id,
      deviceId: String(deviceId).trim(),
      name: String(name).trim(),
      lat: Number(lat),
      lon: Number(lon),
      radiusMeters: radius,
      alertOnEnter: alertOnEnter !== false,
      alertOnExit: alertOnExit !== false,
      isActive: true,
      lastState: 'unknown',
      createdAt: now,
      updatedAt: now,
    };
    store.geofences.push(created!);
  });

  return NextResponse.json({ geofence: created }, { status: 201 });
}

// ── PATCH – update geofence ────────────────────────────────────────

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  let updated: Geofence | null = null;

  await updateStore((store) => {
    const fence = store.geofences.find((g) => g.id === id && g.ownerUserId === user.id);
    if (!fence) return;

    if (typeof body.name === 'string' && body.name.trim()) fence.name = body.name.trim();
    if (Number.isFinite(Number(body.lat))) fence.lat = Number(body.lat);
    if (Number.isFinite(Number(body.lon))) fence.lon = Number(body.lon);
    if (Number.isFinite(Number(body.radiusMeters)) && Number(body.radiusMeters) > 0) {
      fence.radiusMeters = Number(body.radiusMeters);
    }
    if (typeof body.alertOnEnter === 'boolean') fence.alertOnEnter = body.alertOnEnter;
    if (typeof body.alertOnExit === 'boolean') fence.alertOnExit = body.alertOnExit;
    if (typeof body.isActive === 'boolean') fence.isActive = body.isActive;

    fence.updatedAt = new Date().toISOString();
    updated = fence;
  });

  if (!updated) return NextResponse.json({ error: 'Geofence not found' }, { status: 404 });
  return NextResponse.json({ geofence: updated });
}

// ── DELETE – remove geofence ───────────────────────────────────────

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  let deleted = false;
  await updateStore((store) => {
    const before = store.geofences.length;
    store.geofences = store.geofences.filter((g) => !(g.id === id && g.ownerUserId === user.id));
    deleted = store.geofences.length < before;
  });

  if (!deleted) return NextResponse.json({ error: 'Geofence not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
