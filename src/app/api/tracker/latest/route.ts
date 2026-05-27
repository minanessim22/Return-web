/**
 * /api/tracker/latest
 * ─────────────────────────────────────────────────────────────────
 * Returns the latest known GPS coordinates for every device that
 * has sent at least one MQTT / HTTP report in this server session.
 *
 * The data comes from the global in-memory emitter store – it is
 * NOT persisted between server restarts, but it is always up-to-date
 * because every /api/tracker/report hit AND every MQTT message
 * fires the same emitter.
 *
 * GET /api/tracker/latest
 * Response: { devices: Record<string, LatestEntry> }
 *
 * GET /api/tracker/latest?device_id=A9G-01
 * Response: { device: LatestEntry | null }
 * ─────────────────────────────────────────────────────────────────
 */

import { ensureMqttBridge, getMqttEmitter } from '@/lib/server/mqtt-bridge';
import type { TrackerLocationEvent } from '@/lib/server/mqtt-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── In-process latest-location cache ────────────────────────────
// Keyed by device_id, updated on every "location" event.
const GLOBAL_CACHE_KEY = '__return_tracker_latest__' as const;

type LatestEntry = {
  device_id: string;
  lat: number | null;
  lon: number | null;
  battery?: number;
  receivedAt: string;
  topic: string;
  alertType?: string;
};

function getCache(): Map<string, LatestEntry> {
  const g = globalThis as unknown as Record<string, Map<string, LatestEntry> | undefined>;
  if (!g[GLOBAL_CACHE_KEY]) {
    g[GLOBAL_CACHE_KEY] = new Map();

    // Wire up listener ONCE – idempotent because we check existence above
    const emitter = getMqttEmitter();
    emitter.on('location', (event: TrackerLocationEvent) => {
      g[GLOBAL_CACHE_KEY]!.set(event.device_id, {
        device_id: event.device_id,
        lat: event.lat,
        lon: event.lon,
        battery: event.battery,
        receivedAt: event.receivedAt,
        topic: event.topic,
        alertType: event.alertType,
      });
    });
  }
  return g[GLOBAL_CACHE_KEY]!;
}

export async function GET(request: Request) {
  // Boot the MQTT bridge so events start flowing
  ensureMqttBridge();

  const cache = getCache();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id')?.trim();

  if (deviceId) {
    const entry = cache.get(deviceId) ?? null;
    return Response.json({ device: entry }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Return all known devices
  const devices: Record<string, LatestEntry> = {};
  for (const [id, entry] of cache.entries()) {
    devices[id] = entry;
  }

  return Response.json(
    {
      devices,
      count: cache.size,
      updatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
