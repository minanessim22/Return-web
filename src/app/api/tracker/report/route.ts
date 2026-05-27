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
import { prisma } from '@/lib/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Field alias resolver ──────────────────────────────────────────

interface RawPoint {
  lat?: unknown;
  lon?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  lng?: unknown;
  battery?: unknown;
  batt?: unknown;
  bs?: unknown;             // battery status (Colota)
  tst?: unknown;            // Unix seconds timestamp (Colota)
  timestamp?: unknown;
  acc?: unknown;
  accuracy?: unknown;
  vel?: unknown;
  speed?: unknown;
  alt?: unknown;
  altitude?: unknown;
  bear?: unknown;
  cog?: unknown;            // Colota dawarich mode alias for bearing
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

function resolveNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

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
  };
}

// ── DB persist helper ─────────────────────────────────────────────

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

export async function GET(request: Request) {
  ensureMqttBridge();

  const url = new URL(request.url);
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
  if (!deviceId) {
    return new Response('device_id required', { status: 400 });
  }

  // ── Batch mode: { device_id, locations: [...] } ───────────────
  if (Array.isArray(body.locations) && body.locations.length > 0) {
    const rawList = body.locations as RawPoint[];
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
  }

  // ── Single point mode ─────────────────────────────────────────
  const point = parsePoint(body as RawPoint);

  // Detect source: Colota sends "batt" or "tst" fields
  const source = (body.batt !== undefined || body.tst !== undefined || body.acc !== undefined)
    ? 'colota'
    : 'http';

  await persistPoint(deviceId, point, source);
  emitToSSE(deviceId, point);

  console.log(`[REPORT] ${point.alertType.toUpperCase()} from ${deviceId} → ${point.lat}, ${point.lon}`);

  return new Response('OK', { status: 200 });
}