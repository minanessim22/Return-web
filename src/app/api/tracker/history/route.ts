/**
 * /api/tracker/history
 * ─────────────────────────────────────────────────────────────────
 * Returns chronological GPS location history for a device.
 * Used by the Breadcrumb Trail on the live map and by export features.
 *
 * GET /api/tracker/history?device_id=A9G-01
 *   → last 500 points for this session
 *
 * GET /api/tracker/history?device_id=A9G-01&limit=100
 *   → last 100 points
 *
 * GET /api/tracker/history?device_id=A9G-01&from=2026-05-24T00:00:00Z&to=2026-05-24T23:59:59Z
 *   → all points in the date range (up to 2000)
 *
 * Response:
 * {
 *   "device_id": "A9G-01",
 *   "count": 47,
 *   "trail": [
 *     { "lat": 30.01, "lon": 31.02, "battery": 85, "alertType": "location", "recordedAt": "..." },
 *     ...
 *   ]
 * }
 * ─────────────────────────────────────────────────────────────────
 */

import { getLocationHistory } from '@/lib/server/tracker-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id')?.trim();

  if (!deviceId) {
    return Response.json({ error: 'device_id required' }, { status: 400 });
  }

  const from  = url.searchParams.get('from')  ?? undefined;
  const to    = url.searchParams.get('to')    ?? undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '500', 10);

  const rows = await getLocationHistory(deviceId, from, to, limit);

  const trail = rows.map((r: any) => ({
    lat:        r.lat,
    lon:        r.lon,
    battery:    r.battery ?? undefined,
    altitude:   r.altitude ?? undefined,
    speed:      r.speed ?? undefined,
    accuracy:   r.accuracy ?? undefined,
    bearing:    r.bearing ?? undefined,
    alertType:  r.alert_type,
    source:     r.source,
    recordedAt: r.recorded_at,
    receivedAt: r.received_at,
  }));

  return Response.json(
    {
      device_id: deviceId,
      count: trail.length,
      trail,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    }
  );
}
