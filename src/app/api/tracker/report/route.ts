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
import { insertLocationHistory, insertLocationHistoryBatch, isTrackerRegistered } from '@/lib/server/sqlite-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────

interface RawPoint {
  lat?: unknown;
  lon?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  lng?: unknown;
  battery?: unknown;
  batt?: unknown;
  tst?: unknown;
  timestamp?: unknown;
  acc?: unknown;
  accuracy?: unknown;
  vel?: unknown;
  speed?: unknown;
  alt?: unknown;
  altitude?: unknown;
  bear?: unknown;
  cog?: unknown;
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

// ── Field resolver helpers ─────────────────────────────────────────

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
  };
}

// ── DB persist helper ─────────────────────────────────────────────

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
  const emitter = getMqttEmitter();
  emitter.emit('location', event);
  if (point.alertType === 'fall') emitter.emit('fall_alert', event);
}

// ── GET – A9G board (query params) ───────────────────────────────

export async function GET(request: Request) {
  ensureMqttBridge();

  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id')?.trim() || '';

  if (!deviceId) return new Response('device_id required', { status: 400 });

  // ── Pre-Registration check ─────────────────────────────────────
  if (!isTrackerRegistered(deviceId)) {
    console.warn(`[REPORT GET] REJECTED unregistered device: ${deviceId}`);
    return new Response('Unauthorized device', { status: 401 });
  }

  const raw: RawPoint = {
    lat:     url.searchParams.get('lat'),
    lon:     url.searchParams.get('lon'),
    battery: url.searchParams.get('battery') ?? url.searchParams.get('batt'),
    tst:     url.searchParams.get('tst'),
    acc:     url.searchParams.get('acc'),
    vel:     url.searchParams.get('vel'),
    alt:     url.searchParams.get('alt'),
    bear:    url.searchParams.get('bear'),
    type:    url.searchParams.get('type'),
  };

  const point = parsePoint(raw);

  if (point.lat !== null && (!Number.isFinite(point.lat) || !Number.isFinite(point.lon!))) {
    return new Response('lat/lon invalid', { status: 400 });
  }

  persistOne(deviceId, point, 'http');
  emitToSSE(deviceId, point);

  console.log(`[REPORT GET] ${point.alertType.toUpperCase()} from ${deviceId} → ${point.lat}, ${point.lon}`);

  return new Response('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}

// ── POST – Colota single or batch ─────────────────────────────────

export async function POST(request: Request) {
  ensureMqttBridge();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const deviceId = String(body.device_id ?? body.deviceId ?? '').trim();
  if (!deviceId) return new Response('device_id required', { status: 400 });

  // ── Pre-Registration check ─────────────────────────────────────
  if (!isTrackerRegistered(deviceId)) {
    console.warn(`[REPORT POST] REJECTED unregistered device: ${deviceId}`);
    return new Response('Unauthorized device', { status: 401 });
  }

  // ── Batch mode: { device_id, locations: [...] } ───────────────
  if (Array.isArray(body.locations) && body.locations.length > 0) {
    const rawList = body.locations as RawPoint[];
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

    const { saved, skipped } = insertLocationHistoryBatch(dbRows);

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
  }

  // ── Single point mode ─────────────────────────────────────────
  const point = parsePoint(body as RawPoint);

  if (point.lat !== null && (!Number.isFinite(point.lat) || !Number.isFinite(point.lon!))) {
    return new Response('lat/lon invalid', { status: 400 });
  }

  const source = (body.batt !== undefined || body.tst !== undefined || body.acc !== undefined)
    ? 'colota' as const
    : 'http' as const;

  persistOne(deviceId, point, source);
  emitToSSE(deviceId, point);

  console.log(`[REPORT POST] ${point.alertType.toUpperCase()} from ${deviceId} → ${point.lat}, ${point.lon}`);

  return new Response('OK', { status: 200 });
}