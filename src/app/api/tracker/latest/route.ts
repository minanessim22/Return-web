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

import { ensureMqttBridge } from '@/lib/server/mqtt-bridge';
import { prisma } from '@/lib/server/db';
import { getTrackerCache } from '@/lib/server/tracker-cache';
import type { LatestEntry } from '@/lib/server/tracker-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

/**
 * Fetch the latest location history record for each *registered* device.
 *
 * IMPORTANT: We intentionally query ONLY serial numbers that exist in the
 * `Device` table.  We do NOT union in all distinct `deviceId` values from
 * `location_history`, because that table retains rows for passive QR/NFC
 * scans and previously-deleted devices — including orphan entries that
 * survive even after the DELETE transaction (e.g. QR-prefixed scan events
 * written by the public identify route).  Including those IDs would cause
 * deleted devices to keep appearing on the live map.
 */
async function getAllLatestFromDb(): Promise<Record<string, LatestEntry>> {
  const devices: Record<string, LatestEntry> = {};
  try {
    // Only registered device serial numbers — deleted devices will no longer
    // appear here because their Device row was removed by the DELETE transaction.
    const dbDevices = await prisma.device.findMany({
      select: { serialNumber: true }
    });

    const registeredSerials = dbDevices
      .map(d => d.serialNumber)
      .filter(Boolean) as string[];

    await Promise.all(
      registeredSerials.map(async (serial) => {
        const entry = await getLatestFromDb(serial);
        if (entry) {
          devices[serial] = entry;
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

  const cache = getTrackerCache();
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
