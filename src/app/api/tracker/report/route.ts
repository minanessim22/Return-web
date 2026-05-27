/**
 * /api/tracker/report
 * ─────────────────────────────────────────────────────────────────
 * Universal GPS report endpoint — accepts both A9G board format
 * and Colota app format (with field aliases like batt, tst, acc…).
 *
 * A9G GET format:
 *   GET /api/tracker/report?device_id=A9G-01&lat=30.123&lon=31.456&battery=85
 *
 * Colota POST format (single):
 *   POST /api/tracker/report
 *   { "device_id": "colota-01", "lat": 30.1, "lon": 31.2, "batt": 85, "tst": 1748130000 }
 *
 * Colota POST format (batch — offline flush):
 *   POST /api/tracker/report
 *   { "device_id": "colota-01", "locations": [ {lat, lon, batt, tst}, ... ] }
 *
 * Field aliases accepted:
 *   batt → battery      (Colota default field name)
 *   tst  → recordedAt   (Unix timestamp in seconds)
 *   acc  → accuracy     (GPS accuracy in metres)
 *   vel  → speed        (speed in m/s)
 *   alt  → altitude     (altitude in metres)
 *   bear → bearing      (compass bearing 0-360°)
 *   latitude/longitude  → lat/lon aliases
 * ─────────────────────────────────────────────────────────────────
 */

import { ensureMqttBridge, getMqttEmitter } from '@/lib/server/mqtt-bridge';
import type { TrackerLocationEvent } from '@/lib/server/mqtt-bridge';
<<<<<<< HEAD
import { prisma } from '@/lib/server/prisma';
=======
import { insertLocationHistory, insertLocationHistoryBatch, isTrackerRegistered } from '@/lib/server/sqlite-db';
import { updateStore } from '@/lib/server/store';

// ── Geofence helpers ──────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Check active geofences for the given device and fire notifications on state change */
async function checkGeofences(deviceId: string, lat: number, lon: number) {
  try {
    await updateStore((store) => {
      const fences = store.geofences.filter((g) => g.isActive && g.deviceId === deviceId);
      for (const fence of fences) {
        const dist = haversineMeters(lat, lon, fence.lat, fence.lon);
        const isInside = dist <= fence.radiusMeters;
        const prevState = fence.lastState ?? 'unknown';
        const newState = isInside ? 'inside' : 'outside';

        fence.lastState = newState;
        fence.lastCheckedAt = new Date().toISOString();

        if (prevState === 'unknown') continue; // first reading, no alert

        if (isInside && prevState === 'outside' && fence.alertOnEnter) {
          // Entered the geofence
          const owner = store.users.find((u) => u.id === fence.ownerUserId);
          if (owner) {
            store.notifications.unshift({
              id: `notif_${Date.now()}`,
              userId: fence.ownerUserId,
              title: `📍 دخل النطاق: ${fence.name}`,
              body: `الجهاز ${deviceId} دخل نطاق "${fence.name}"`,
              type: 'geofence_enter',
              isRead: false,
              createdAt: new Date().toISOString(),
            } as any);
          }
        } else if (!isInside && prevState === 'inside' && fence.alertOnExit) {
          // Exited the geofence
          const owner = store.users.find((u) => u.id === fence.ownerUserId);
          if (owner) {
            store.notifications.unshift({
              id: `notif_${Date.now()}`,
              userId: fence.ownerUserId,
              title: `🚪 خرج من النطاق: ${fence.name}`,
              body: `الجهاز ${deviceId} خرج من نطاق "${fence.name}"`,
              type: 'geofence_exit',
              isRead: false,
              createdAt: new Date().toISOString(),
            } as any);
          }
        }
      }
    });
  } catch {
    // Non-fatal — geofence check failure shouldn't block GPS reporting
  }
}
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

<<<<<<< HEAD
// ── Field alias resolver ──────────────────────────────────────────
=======
// ── Types ─────────────────────────────────────────────────────────
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782

interface RawPoint {
  lat?: unknown;
  lon?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  lng?: unknown;
  battery?: unknown;
  batt?: unknown;
<<<<<<< HEAD
  bs?: unknown;             // battery status (Colota)
  tst?: unknown;            // Unix seconds timestamp (Colota)
=======
  tst?: unknown;
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
  timestamp?: unknown;
  acc?: unknown;
  accuracy?: unknown;
  vel?: unknown;
  speed?: unknown;
  alt?: unknown;
  altitude?: unknown;
  bear?: unknown;
<<<<<<< HEAD
  cog?: unknown;            // Colota dawarich mode alias for bearing
=======
  cog?: unknown;
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
  bearing?: unknown;
  type?: unknown;
  alertType?: unknown;
}

interface ParsedPoint {
  lat: number | null;
  lon: number | null;
  battery?: number;
  accuracy?: number;
  speed?: number;
  altitude?: number;
  bearing?: number;
  alertType: string;
  recordedAt: Date;
}

<<<<<<< HEAD
function resolveNumber(val: unknown): number | undefined {
=======
// ── Field resolver helpers ─────────────────────────────────────────

function num(val: unknown): number | undefined {
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
  if (val === null || val === undefined || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

<<<<<<< HEAD
function resolveNullableCoord(raw: unknown): number | null {
  if (raw === null || raw === 'null' || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function resolveTimestamp(tst: unknown, fallback: Date): Date {
  if (tst === undefined || tst === null) return fallback;
  const n = Number(tst);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // If value looks like Unix seconds (< year 9999 in seconds ≈ 253402300800)
  return n < 1e10 ? new Date(n * 1000) : new Date(n);
}

function parsePoint(raw: RawPoint, alertType?: string): ParsedPoint {
  const now = new Date();

  const lat = resolveNullableCoord(raw.lat ?? raw.latitude);
  const lon = resolveNullableCoord(raw.lon ?? raw.longitude ?? raw.lng);

  // battery: prefer explicit field, fall back to Colota aliases
  const battery = resolveNumber(raw.battery ?? raw.batt);
  const batteryInt = battery !== undefined ? Math.round(battery > 1 ? battery : battery * 100) : undefined;

  return {
    lat,
    lon,
    battery: batteryInt,
    accuracy: resolveNumber(raw.acc ?? raw.accuracy),
    speed: resolveNumber(raw.vel ?? raw.speed),
    altitude: resolveNumber(raw.alt ?? raw.altitude),
    bearing: resolveNumber(raw.bear ?? raw.cog ?? raw.bearing),
    alertType: String(alertType ?? raw.alertType ?? raw.type ?? 'location').trim(),
    recordedAt: resolveTimestamp(raw.tst ?? raw.timestamp, now),
=======
function nullableCoord(val: unknown): number | null {
  if (val === null || val === 'null' || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toDate(tst: unknown): Date {
  const fallback = new Date();
  if (tst === undefined || tst === null) return fallback;
  const n = Number(tst);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // Colota sends Unix seconds (<1e10); some clients send ms (>1e10)
  return n < 1e10 ? new Date(n * 1000) : new Date(n);
}

function resolveBattery(raw: RawPoint): number | undefined {
  const b = num(raw.battery ?? raw.batt);
  if (b === undefined) return undefined;
  // Normalise: Colota sends 0-100; some libs send 0.0-1.0
  return Math.round(b > 1 ? b : b * 100);
}

function parsePoint(raw: RawPoint, defaultAlertType = 'location'): ParsedPoint {
  return {
    lat: nullableCoord(raw.lat ?? raw.latitude),
    lon: nullableCoord(raw.lon ?? raw.longitude ?? raw.lng),
    battery: resolveBattery(raw),
    accuracy: num(raw.acc ?? raw.accuracy),
    speed: num(raw.vel ?? raw.speed),
    altitude: num(raw.alt ?? raw.altitude),
    bearing: num(raw.bear ?? raw.cog ?? raw.bearing),
    alertType: String(raw.alertType ?? raw.type ?? defaultAlertType).trim(),
    recordedAt: toDate(raw.tst ?? raw.timestamp),
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
  };
}

// ── DB persist helper ─────────────────────────────────────────────

<<<<<<< HEAD
async function persistPoint(
  deviceId: string,
  point: ParsedPoint,
  source: 'http' | 'colota' | 'batch' | 'mqtt' = 'http',
): Promise<void> {
  if (point.lat === null || point.lon === null) return; // no fix — skip
  try {
    await prisma.locationHistory.create({
      data: {
        deviceId,
        lat: point.lat,
        lon: point.lon,
        battery: point.battery ?? null,
        altitude: point.altitude ?? null,
        speed: point.speed ?? null,
        accuracy: point.accuracy ?? null,
        bearing: point.bearing ?? null,
        alertType: point.alertType,
        source,
        recordedAt: point.recordedAt,
      },
    });
  } catch (err) {
    // Non-fatal — SSE emission still proceeds
=======
function persistOne(
  deviceId: string,
  point: ParsedPoint,
  source: 'http' | 'colota' | 'batch' | 'mqtt',
): void {
  if (point.lat === null || point.lon === null) return;
  try {
    insertLocationHistory({
      device_id: deviceId,
      lat: point.lat,
      lon: point.lon,
      battery: point.battery ?? null,
      altitude: point.altitude ?? null,
      speed: point.speed ?? null,
      accuracy: point.accuracy ?? null,
      bearing: point.bearing ?? null,
      alert_type: point.alertType,
      source,
      recorded_at: point.recordedAt.toISOString(),
      received_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-fatal — SSE continues even if DB is locked
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
    console.error('[REPORT] DB persist error:', err);
  }
}

// ── SSE emit helper ───────────────────────────────────────────────

function emitToSSE(deviceId: string, point: ParsedPoint): void {
  const event: TrackerLocationEvent = {
    device_id: deviceId,
    lat: point.lat,
    lon: point.lon,
    battery: point.battery,
    timestamp: point.recordedAt.toISOString(),
    receivedAt: new Date().toISOString(),
    topic: `return/tracker/${deviceId}/report`,
    alertType: point.alertType,
  };
<<<<<<< HEAD

  const emitter = getMqttEmitter();
  emitter.emit('location', event);
  if (point.alertType === 'fall') {
    emitter.emit('fall_alert', event);
  }
}

// ── Query-param parser (A9G GET format) ───────────────────────────

function parseGetParams(url: URL): { deviceId: string; raw: RawPoint } | { error: string } {
  const deviceId = url.searchParams.get('device_id')?.trim() || '';
  if (!deviceId) return { error: 'device_id required' };

  return {
    deviceId,
    raw: {
      lat: url.searchParams.get('lat'),
      lon: url.searchParams.get('lon'),
      battery: url.searchParams.get('battery') ?? url.searchParams.get('batt'),
      tst: url.searchParams.get('tst'),
      acc: url.searchParams.get('acc'),
      vel: url.searchParams.get('vel'),
      alt: url.searchParams.get('alt'),
      bear: url.searchParams.get('bear'),
      type: url.searchParams.get('type'),
    },
  };
}

// ── GET – A9G board sends this ────────────────────────────────────
=======
  const emitter = getMqttEmitter();
  emitter.emit('location', event);
  if (point.alertType === 'fall') emitter.emit('fall_alert', event);
}

// ── GET – A9G board (query params) ───────────────────────────────
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782

export async function GET(request: Request) {
  ensureMqttBridge();

  const url = new URL(request.url);
<<<<<<< HEAD
  const parsed = parseGetParams(url);

  if ('error' in parsed) {
    return new Response(parsed.error, { status: 400 });
  }

  const { deviceId, raw } = parsed;
  const point = parsePoint(raw);
  const alertType = String(raw.type ?? 'location').trim();

  await persistPoint(deviceId, { ...point, alertType }, 'http');
  emitToSSE(deviceId, { ...point, alertType });

  console.log(`[REPORT] ${alertType.toUpperCase()} from ${deviceId} → ${point.lat}, ${point.lon}`);

  return new Response('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store',
    },
=======
  const deviceId = url.searchParams.get('device_id')?.trim() || url.searchParams.get('id')?.trim() || url.searchParams.get('imei')?.trim() || '';

  if (!deviceId) return new Response('device_id required', { status: 400 });

  // ── Pre-Registration check ─────────────────────────────────────
  if (!await isTrackerRegistered(deviceId)) {
    console.warn(`[REPORT GET] REJECTED unregistered device: ${deviceId}`);
    return new Response('Unauthorized device', { status: 401 });
  }

  const raw: RawPoint = {
    lat: url.searchParams.get('lat'),
    lon: url.searchParams.get('lon'),
    battery: url.searchParams.get('battery') ?? url.searchParams.get('batt'),
    tst: url.searchParams.get('tst'),
    acc: url.searchParams.get('acc'),
    vel: url.searchParams.get('vel'),
    alt: url.searchParams.get('alt'),
    bear: url.searchParams.get('bear'),
    type: url.searchParams.get('type'),
  };

  const point = parsePoint(raw);

  if (point.lat !== null && (!Number.isFinite(point.lat) || !Number.isFinite(point.lon!))) {
    return new Response('lat/lon invalid', { status: 400 });
  }

  persistOne(deviceId, point, 'http');
  emitToSSE(deviceId, point);

  // Check geofences asynchronously (non-blocking)
  if (point.lat !== null && point.lon !== null) {
    checkGeofences(deviceId, point.lat, point.lon!).catch(() => {});
  }

  console.log(`[REPORT GET] ${point.alertType.toUpperCase()} from ${deviceId} → ${point.lat}, ${point.lon}`);

  return new Response('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
  });
}

// ── POST – Colota single or batch ─────────────────────────────────

export async function POST(request: Request) {
  ensureMqttBridge();

<<<<<<< HEAD
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const deviceId = String(body.device_id ?? body.deviceId ?? '').trim();
  if (!deviceId) {
    return new Response('device_id required', { status: 400 });
=======
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // If not JSON, it might be an empty body with query params
  }

  const url = new URL(request.url);
  const deviceId = String(body.device_id ?? body.deviceId ?? body.id ?? body.imei ?? url.searchParams.get('id') ?? url.searchParams.get('device_id') ?? url.searchParams.get('imei') ?? '').trim();

  if (!deviceId) return new Response('device_id required', { status: 400 });

  // ── Pre-Registration check ─────────────────────────────────────
  if (!await isTrackerRegistered(deviceId)) {
    console.warn(`[REPORT POST] REJECTED unregistered device: ${deviceId}`);
    return new Response('Unauthorized device', { status: 401 });
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
  }

  // ── Batch mode: { device_id, locations: [...] } ───────────────
  if (Array.isArray(body.locations) && body.locations.length > 0) {
    const rawList = body.locations as RawPoint[];
<<<<<<< HEAD
    let saved = 0;
    let failed = 0;

    // Process in parallel (max 50 at once to avoid connection pool saturation)
    const chunks = [];
    for (let i = 0; i < rawList.length; i += 50) {
      chunks.push(rawList.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (raw) => {
          try {
            const point = parsePoint(raw);
            await persistPoint(deviceId, point, 'batch');
            emitToSSE(deviceId, point);
            saved++;
          } catch {
            failed++;
          }
        })
      );
    }

    console.log(`[REPORT] BATCH from ${deviceId}: ${saved} saved, ${failed} failed`);
    return Response.json({ saved, failed }, { status: 200 });
=======
    const now = new Date().toISOString();

    const dbRows = rawList
      .map((raw) => {
        const p = parsePoint(raw);
        if (p.lat === null || p.lon === null) return null;
        return {
          device_id: deviceId,
          lat: p.lat,
          lon: p.lon!,
          battery: p.battery ?? null,
          altitude: p.altitude ?? null,
          speed: p.speed ?? null,
          accuracy: p.accuracy ?? null,
          bearing: p.bearing ?? null,
          alert_type: p.alertType,
          source: 'batch' as const,
          recorded_at: p.recordedAt.toISOString(),
          received_at: now,
        };
      })
      .filter(Boolean) as Parameters<typeof insertLocationHistoryBatch>[0];

    const { saved, skipped } = await insertLocationHistoryBatch(dbRows);

    // Emit each to SSE so dashboard shows movement even from backfill
    const emitter = getMqttEmitter();
    for (const row of dbRows) {
      const event: TrackerLocationEvent = {
        device_id: deviceId,
        lat: row.lat,
        lon: row.lon,
        battery: row.battery ?? undefined,
        timestamp: row.recorded_at,
        receivedAt: now,
        topic: `return/tracker/${deviceId}/batch`,
        alertType: row.alert_type,
      };
      emitter.emit('location', event);
    }

    console.log(`[REPORT BATCH] ${deviceId}: ${rawList.length} in → ${saved} saved, ${skipped} skipped`);
    return Response.json({ saved, skipped, failed: rawList.length - dbRows.length }, { status: 200 });
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
  }

  // ── Single point mode ─────────────────────────────────────────
  const point = parsePoint(body as RawPoint);

<<<<<<< HEAD
  // Detect source: Colota sends "batt" or "tst" fields
  const source = (body.batt !== undefined || body.tst !== undefined || body.acc !== undefined)
    ? 'colota'
    : 'http';

  await persistPoint(deviceId, point, source);
  emitToSSE(deviceId, point);

  console.log(`[REPORT] ${point.alertType.toUpperCase()} from ${deviceId} → ${point.lat}, ${point.lon}`);
=======
  if (point.lat !== null && (!Number.isFinite(point.lat) || !Number.isFinite(point.lon!))) {
    return new Response('lat/lon invalid', { status: 400 });
  }

  const source = (body.batt !== undefined || body.tst !== undefined || body.acc !== undefined)
    ? 'colota' as const
    : 'http' as const;

  persistOne(deviceId, point, source);
  emitToSSE(deviceId, point);

  // Check geofences asynchronously (non-blocking)
  if (point.lat !== null && point.lon !== null) {
    checkGeofences(deviceId, point.lat, point.lon!).catch(() => {});
  }

  console.log(`[REPORT POST] ${point.alertType.toUpperCase()} from ${deviceId} → ${point.lat}, ${point.lon}`);
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782

  return new Response('OK', { status: 200 });
}