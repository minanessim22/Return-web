/**
 * /api/tracker/batch
 * ─────────────────────────────────────────────────────────────────
 * Bulk offline-flush endpoint for Colota and any custom GPS client.
 *
 * Called automatically when the device comes back online after a
 * GSM/WiFi drop. The client sends all queued points in one request.
 *
 * Request:
 *   POST /api/tracker/batch
 *   Content-Type: application/json
 *   {
 *     "device_id": "colota-01",
 *     "locations": [
 *       { "lat": 30.01, "lon": 31.02, "batt": 85, "tst": 1748130000, "acc": 5 },
 *       { "lat": 30.02, "lon": 31.03, "batt": 84, "tst": 1748130030, "acc": 6 }
 *     ]
 *   }
 *
 * Response:
 *   200  { "saved": 47, "skipped": 3, "failed": 0 }
 *
 * Notes:
 *   - Points missing lat/lon are counted as "failed" and silently dropped
 *   - Duplicate (device_id, recorded_at) rows are counted as "skipped"
 *   - The endpoint always returns 200 with counts — the client decides
 *     whether to clear its local queue based on saved > 0
 *   - All saved points are also emitted to the SSE stream so the live
 *     map updates in real time when connectivity is restored
 * ─────────────────────────────────────────────────────────────────
 */

import { ensureMqttBridge, getMqttEmitter } from '@/lib/server/mqtt-bridge';
import type { TrackerLocationEvent } from '@/lib/server/mqtt-bridge';
import { insertLocationHistoryBatch, isTrackerRegistered } from '@/lib/server/sqlite-db';
import type { LocationHistoryRow } from '@/lib/server/sqlite-db';
import { updateStore } from '@/lib/server/store';

// ── Geofence helpers (shared with report route) ───────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
        if (prevState === 'unknown') continue;
        if (isInside && prevState === 'outside' && fence.alertOnEnter) {
          store.notifications.unshift({ id: `notif_${Date.now()}`, userId: fence.ownerUserId, title: `📍 دخل النطاق: ${fence.name}`, body: `الجهاز ${deviceId} دخل نطاق "${fence.name}"`, type: 'geofence_enter', isRead: false, createdAt: new Date().toISOString() } as any);
        } else if (!isInside && prevState === 'inside' && fence.alertOnExit) {
          store.notifications.unshift({ id: `notif_${Date.now()}`, userId: fence.ownerUserId, title: `🚪 خرج من النطاق: ${fence.name}`, body: `الجهاز ${deviceId} خرج من نطاق "${fence.name}"`, type: 'geofence_exit', isRead: false, createdAt: new Date().toISOString() } as any);
        }
      }
    });
  } catch { /* non-fatal */ }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Field resolver helpers ─────────────────────────────────────────

interface RawPoint {
  lat?: unknown; latitude?: unknown;
  lon?: unknown; longitude?: unknown;
  battery?: unknown; batt?: unknown;
  tst?: unknown; timestamp?: unknown;
  acc?: unknown; accuracy?: unknown;
  vel?: unknown; speed?: unknown;
  alt?: unknown; altitude?: unknown;
  bear?: unknown; cog?: unknown; bearing?: unknown;
  type?: unknown;
}

function num(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function nullableCoord(val: unknown): number | null {
  if (val === null || val === 'null' || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toISOString(tst: unknown, fallback: string): string {
  if (tst === undefined || tst === null) return fallback;
  const n = Number(tst);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n < 1e10 ? new Date(n * 1000).toISOString() : new Date(n).toISOString();
}

function resolveBattery(raw: RawPoint): number | null {
  const b = num(raw.battery ?? raw.batt);
  if (b === undefined) return null;
  return Math.round(b > 1 ? b : b * 100);
}

// ── POST handler ──────────────────────────────────────────────────

export async function POST(request: Request) {
  ensureMqttBridge();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const deviceId = String(body.device_id ?? body.deviceId ?? '').trim();
  if (!deviceId) {
    return Response.json({ error: 'device_id required' }, { status: 400 });
  }

  // ── Pre-Registration check ─────────────────────────────────────
  if (!await isTrackerRegistered(deviceId)) {
    console.warn(`[BATCH] REJECTED unregistered device: ${deviceId}`);
    return Response.json({ error: 'Unauthorized device' }, { status: 401 });
  }

  if (!Array.isArray(body.locations) || body.locations.length === 0) {
    return Response.json({ error: 'locations array required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rawList = body.locations as RawPoint[];
  let failed = 0;

  // Build DB rows — drop points without a valid fix
  const dbRows: Omit<LocationHistoryRow, 'id'>[] = [];
  const emitList: { lat: number; lon: number; battery?: number; recorded_at: string; alertType: string }[] = [];

  for (const raw of rawList) {
    const lat = nullableCoord(raw.lat ?? raw.latitude);
    const lon = nullableCoord(raw.lon ?? raw.longitude);
    if (lat === null || lon === null) { failed++; continue; }

    const recorded_at = toISOString(raw.tst ?? raw.timestamp, now);
    const battery = resolveBattery(raw);
    const alertType = String(raw.type ?? 'location').trim();

    dbRows.push({
      device_id: deviceId,
      lat,
      lon,
      battery,
      altitude: num(raw.alt ?? raw.altitude) ?? null,
      speed: num(raw.vel ?? raw.speed) ?? null,
      accuracy: num(raw.acc ?? raw.accuracy) ?? null,
      bearing: num(raw.bear ?? raw.cog ?? raw.bearing) ?? null,
      alert_type: alertType,
      source: 'batch',
      recorded_at,
      received_at: now,
    });

    emitList.push({ lat, lon, battery: battery ?? undefined, recorded_at, alertType });
  }

  // Bulk DB insert in a single transaction
  const { saved, skipped } = await insertLocationHistoryBatch(dbRows);

  // Emit all valid points to SSE so live map updates immediately
  const emitter = getMqttEmitter();
  for (const pt of emitList) {
    const event: TrackerLocationEvent = {
      device_id: deviceId,
      lat: pt.lat,
      lon: pt.lon,
      battery: pt.battery,
      timestamp: pt.recorded_at,
      receivedAt: now,
      topic: `return/tracker/${deviceId}/batch`,
      alertType: pt.alertType,
    };
    emitter.emit('location', event);
    if (pt.alertType === 'fall') emitter.emit('fall_alert', event);
  }

  // Geofence check on the latest point in the batch
  if (emitList.length > 0) {
    const last = emitList[emitList.length - 1];
    checkGeofences(deviceId, last.lat, last.lon).catch(() => {});
  }

  console.log(
    `[BATCH] ${deviceId}: ${rawList.length} received → ${saved} saved, ${skipped} skipped, ${failed} failed (no-fix)`
  );

  return Response.json({ saved, skipped, failed }, { status: 200 });
}
