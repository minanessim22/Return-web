/**
 * /api/tracker/stats
 * ─────────────────────────────────────────────────────────────────
 * Daily statistics for a GPS device.
 *
 * GET /api/tracker/stats?device_id=colota01
 *   → Today's stats + last 7 days summary
 *
 * GET /api/tracker/stats?device_id=colota01&date=2026-05-26
 *   → Stats for a specific day (ISO date string YYYY-MM-DD)
 *
 * Response:
 * {
 *   "device_id": "colota01",
 *   "date": "2026-05-26",
 *   "totalPoints": 142,
 *   "totalDistanceKm": 12.4,
 *   "activeMinutes": 87,
 *   "avgSpeedKmh": 8.6,
 *   "maxSpeedKmh": 45.2,
 *   "avgBattery": 72,
 *   "minBattery": 58,
 *   "firstSeen": "2026-05-26T06:12:00Z",
 *   "lastSeen": "2026-05-26T19:47:00Z",
 *   "alertCount": { "location": 138, "fall": 4 },
 *   "weekSummary": [ { date, distanceKm, points }, ... ]
 * }
 * ─────────────────────────────────────────────────────────────────
 */

import { getLocationHistory } from '@/lib/server/sqlite-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Haversine distance ────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Stats computation ─────────────────────────────────────────────

interface DayStats {
  date: string;
  totalPoints: number;
  totalDistanceKm: number;
  activeMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  avgBattery: number | null;
  minBattery: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  alertCount: Record<string, number>;
}

function computeStats(rows: any[], date: string): DayStats {
  const stats: DayStats = {
    date,
    totalPoints: rows.length,
    totalDistanceKm: 0,
    activeMinutes: 0,
    avgSpeedKmh: 0,
    maxSpeedKmh: 0,
    avgBattery: null,
    minBattery: null,
    firstSeen: null,
    lastSeen: null,
    alertCount: {},
  };

  if (rows.length === 0) return stats;

  // Sort by recorded_at
  const sorted = [...rows].sort((a, b) =>
    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  stats.firstSeen = sorted[0].recorded_at;
  stats.lastSeen = sorted[sorted.length - 1].recorded_at;

  // Distance
  let totalDist = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const d = haversineKm(prev.lat, prev.lon, curr.lat, curr.lon);
    if (d < 10) totalDist += d; // ignore GPS jumps > 10km
  }
  stats.totalDistanceKm = Math.round(totalDist * 100) / 100;

  // Speed (from speed field or estimated from distance/time)
  const speeds = sorted
    .map((r) => r.speed)
    .filter((s) => s !== null && s !== undefined && Number.isFinite(s) && s >= 0)
    .map((s) => s * 3.6); // m/s → km/h

  if (speeds.length > 0) {
    stats.avgSpeedKmh = Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10;
    stats.maxSpeedKmh = Math.round(Math.max(...speeds) * 10) / 10;
  } else if (sorted.length >= 2) {
    // Estimate from distance and time span
    const firstTime = new Date(sorted[0].recorded_at).getTime();
    const lastTime = new Date(sorted[sorted.length - 1].recorded_at).getTime();
    const hours = (lastTime - firstTime) / 3_600_000;
    stats.avgSpeedKmh = hours > 0 ? Math.round((totalDist / hours) * 10) / 10 : 0;
  }

  // Active minutes (sum of intervals < 10 min between consecutive points)
  let activeMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].recorded_at).getTime() - new Date(sorted[i - 1].recorded_at).getTime();
    if (gap < 600_000) activeMs += gap; // < 10 min gap = active
  }
  stats.activeMinutes = Math.round(activeMs / 60_000);

  // Battery
  const batts = sorted
    .map((r) => r.battery)
    .filter((b) => b !== null && b !== undefined && Number.isFinite(b));
  if (batts.length > 0) {
    stats.avgBattery = Math.round(batts.reduce((a, b) => a + b, 0) / batts.length);
    stats.minBattery = Math.min(...batts);
  }

  // Alert count
  for (const row of sorted) {
    const type = row.alert_type || 'location';
    stats.alertCount[type] = (stats.alertCount[type] || 0) + 1;
  }

  return stats;
}

// ── GET handler ───────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id')?.trim();

  if (!deviceId) {
    return Response.json({ error: 'device_id required' }, { status: 400 });
  }

  // Determine target date (default: today)
  const dateParam = url.searchParams.get('date');
  const targetDate = dateParam
    ? dateParam.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Fetch current day
  const dayFrom = `${targetDate}T00:00:00.000Z`;
  const dayTo   = `${targetDate}T23:59:59.999Z`;
  const dayRows = await getLocationHistory(deviceId, dayFrom, dayTo, 2000);
  const dayStats = computeStats(dayRows, targetDate);

  // Fetch last 7 days summary
  const weekSummary: { date: string; distanceKm: number; points: number; activeMinutes: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (ds === targetDate) {
      weekSummary.push({ date: ds, distanceKm: dayStats.totalDistanceKm, points: dayStats.totalPoints, activeMinutes: dayStats.activeMinutes });
      continue;
    }
    const from = `${ds}T00:00:00.000Z`;
    const to   = `${ds}T23:59:59.999Z`;
    const rows = await getLocationHistory(deviceId, from, to, 2000);
    const s = computeStats(rows, ds);
    weekSummary.push({ date: ds, distanceKm: s.totalDistanceKm, points: s.totalPoints, activeMinutes: s.activeMinutes });
  }

  return Response.json(
    {
      device_id: deviceId,
      ...dayStats,
      weekSummary,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
