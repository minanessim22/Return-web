/**
 * DEBUG ENDPOINT — DELETE AFTER TESTING
 * 
 * GET /api/debug/realtime-check
 * 
 * Checks:
 * 1. Supabase client is configured
 * 2. Can query location_history table
 * 3. Supabase Realtime replication status
 */

import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, unknown> = {};

  // 1. Check env vars
  checks.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing';
  checks.supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? '✅ Set' : '❌ Missing';
  checks.databaseUrl = process.env.DATABASE_URL ? '✅ Set' : '❌ Missing';

  // 2. Check DB connection & latest location
  try {
    const latest = await prisma.locationHistory.findFirst({
      orderBy: { receivedAt: 'desc' },
      select: { deviceId: true, lat: true, lon: true, receivedAt: true, source: true },
    });
    checks.dbConnection = '✅ Connected';
    checks.latestRecord = latest ?? 'No records found';
  } catch (err) {
    checks.dbConnection = `❌ Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 3. Check Supabase Realtime replication status
  try {
    const replicationResult = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_catalog.pg_publication_tables 
      WHERE pubname = 'supabase_realtime'
    `;
    const tables = replicationResult.map(r => r.tablename);
    checks.realtimeEnabled = tables.includes('location_history') 
      ? '✅ location_history is in supabase_realtime publication'
      : `❌ location_history NOT found. Tables in publication: [${tables.join(', ')}]`;
  } catch (err) {
    checks.realtimeReplication = `❌ Query failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 4. Count recent records (last 5 minutes)
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const count = await prisma.locationHistory.count({
      where: { receivedAt: { gte: fiveMinAgo } },
    });
    checks.recentRecords = `${count} records in last 5 minutes`;
  } catch {
    checks.recentRecords = 'Query failed';
  }

  return Response.json(checks, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
