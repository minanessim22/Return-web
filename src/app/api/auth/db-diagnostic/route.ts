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

  // Test Prisma Connection and fetch users
  let prismaUsersList: any[] = [];
  try {
    const dbUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true,
      }
    });
    prismaUsersList = dbUsers;
    diagnostics.prisma_connection = `success (users count: ${dbUsers.length})`;
  } catch (err: any) {
    diagnostics.prisma_connection = 'failed';
    diagnostics.error = {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
    };
  }

  // Test Raw Store Read and fetch store users
  let storeUsersList: any[] = [];
  try {
    const rawStore = await readRawStoreFromSqlite();
    if (rawStore) {
      diagnostics.raw_store_read = `success (keys: ${Object.keys(rawStore).join(', ')})`;
      if (Array.isArray(rawStore.users)) {
        storeUsersList = rawStore.users.map((u: any) => ({
          id: u.id,
          email: u.email,
          username: u.username,
          role: u.role,
          status: u.status,
          failedLoginCount: u.failedLoginCount,
          lockedUntil: u.lockedUntil,
          passwordHashType: u.passwordHash ? u.passwordHash.split(':')[0] : 'none',
        }));
      }
    } else {
      diagnostics.raw_store_read = 'returned null';
    }
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

  diagnostics.users_in_db = prismaUsersList;
  diagnostics.users_in_store = storeUsersList;

  return Response.json(diagnostics, { status: diagnostics.error ? 500 : 200 });
}
