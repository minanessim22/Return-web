/**
 * /api/tracker/latest
 * ─────────────────────────────────────────────────────────────────
 * Returns the latest known GPS coordinates for a device.
 *
 * Priority order:
 *   1. In-memory emitter cache (updated on every live report)
 *   2. Database fallback (last row in location_history) — survives
 *      serverless cold starts / Vercel function restarts.
 *
 * GET /api/tracker/latest?device_id=A9G-01
 * Response: { device: LatestEntry | null }
 *
 * GET /api/tracker/latest
 * Response: { devices: Record<string, LatestEntry>, count: number }
 * ─────────────────────────────────────────────────────────────────
 */

import { ensureMqttBridge, getMqttEmitter } from '@/lib/server/mqtt-bridge';
import type { TrackerLocationEvent } from '@/lib/server/mqtt-bridge';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── In-process latest-location cache ────────────────────────────
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

/** Fetch the most recent row from DB for a specific device */
async function getLatestFromDb(deviceId: string): Promise<LatestEntry | null> {
  try {
    const row = await prisma.locationHistory.findFirst({
      where: { deviceId },
      orderBy: { receivedAt: 'desc' },
    });
    if (!row) return null;
    return {
      device_id: row.deviceId,
      lat: row.lat,
      lon: row.lon,
      battery: row.battery ?? undefined,
      receivedAt: row.receivedAt.toISOString(),
      topic: `db/${row.source}/${row.deviceId}`,
      alertType: row.alertType || 'location',
    };
  } catch {
    return null;
  }
}

/** Fetch the latest location history records for all devices in DB */
async function getAllLatestFromDb(): Promise<Record<string, LatestEntry>> {
  const devices: Record<string, LatestEntry> = {};
  try {
    // 1. Get all registered device serial numbers
    const dbDevices = await prisma.device.findMany({
      select: { serialNumber: true }
    });
    
    // 2. Also get any other device IDs from location_history to be safe
    const locationDevices = await prisma.locationHistory.groupBy({
      by: ['deviceId']
    });
    
    const allDeviceIds = new Set([
      ...dbDevices.map(d => d.serialNumber).filter(Boolean),
      ...locationDevices.map(l => l.deviceId).filter(Boolean)
    ]);
    
    // 3. For each device ID, fetch the latest history record
    await Promise.all(
      Array.from(allDeviceIds).map(async (deviceId) => {
        const entry = await getLatestFromDb(deviceId);
        if (entry) {
          devices[deviceId] = entry;
        }
      })
    );
  } catch (err) {
    console.error('Error fetching all latest from DB:', err);
  }
  return devices;
}

export async function GET(request: Request) {
  ensureMqttBridge();

  const cache = getCache();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id')?.trim();

  if (deviceId) {
    // 1. Check live cache first
    let entry: LatestEntry | null = cache.get(deviceId) ?? null;
    // 2. Fall back to DB if cache is cold (e.g. after server restart)
    if (!entry) {
      entry = await getLatestFromDb(deviceId);
    }
    return Response.json({ device: entry }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // 1. Seed with latest DB records
  const dbLatest = await getAllLatestFromDb();
  const devices: Record<string, LatestEntry> = { ...dbLatest };

  // 2. Merge cache on top of database records
  for (const [id, entry] of cache.entries()) {
    devices[id] = entry;
  }

  return Response.json(
    {
      devices,
      count: Object.keys(devices).length,
      updatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
