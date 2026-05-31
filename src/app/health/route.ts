import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /health — Performs a real Prisma connectivity probe against the database.
 * Returns 200 if the DB is reachable, 503 if it is not.
 * Never leaks raw Prisma errors, connection strings, or stack traces.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      database: 'connected',
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (err) {
    console.error('[Health Check] Database probe failed:', err);
    return NextResponse.json({
      ok: false,
      database: 'unavailable',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}

/**
 * HEAD /health — Lightweight probe for uptime monitors.
 */
export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}