import { prisma } from '@/lib/server/db';
import { readRawStoreFromSqlite } from '@/lib/server/sqlite-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      has_database_url: !!process.env.DATABASE_URL,
      has_direct_url: !!process.env.DIRECT_URL,
      database_url_parsed: null,
      direct_url_parsed: null,
    },
    prisma_connection: 'not_tested',
    raw_store_read: 'not_tested',
    error: null,
  };

  // Parse URLs safely to show config without passwords
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      diagnostics.env.database_url_parsed = {
        protocol: url.protocol,
        host: url.host,
        pathname: url.pathname,
        search: url.search,
      };
    } catch (e: any) {
      diagnostics.env.database_url_parsed = { error: 'Failed to parse: ' + e.message };
    }
  }

  if (process.env.DIRECT_URL) {
    try {
      const url = new URL(process.env.DIRECT_URL);
      diagnostics.env.direct_url_parsed = {
        protocol: url.protocol,
        host: url.host,
        pathname: url.pathname,
        search: url.search,
      };
    } catch (e: any) {
      diagnostics.env.direct_url_parsed = { error: 'Failed to parse: ' + e.message };
    }
  }

  // Test Prisma Connection
  try {
    const userCount = await prisma.user.count();
    diagnostics.prisma_connection = `success (users count: ${userCount})`;
  } catch (err: any) {
    diagnostics.prisma_connection = 'failed';
    diagnostics.error = {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
    };
  }

  // Test Raw Store Read
  try {
    const rawStore = await readRawStoreFromSqlite();
    diagnostics.raw_store_read = rawStore ? `success (keys: ${Object.keys(rawStore).join(', ')})` : 'returned null';
  } catch (err: any) {
    diagnostics.raw_store_read = 'failed: ' + err.message;
    if (!diagnostics.error) {
      diagnostics.error = {
        message: err.message,
        code: err.code,
        meta: err.meta,
        stack: err.stack,
      };
    }
  }

  return Response.json(diagnostics, { status: diagnostics.error ? 500 : 200 });
}
