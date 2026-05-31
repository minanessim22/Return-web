import { prisma } from '@/lib/server/db';
import { getDatabaseHealth, getTableSummary } from '@/lib/server/tracker-db';
import { apiJson, requireAdmin, safeServerError } from '@/lib/server/http';

export const runtime = 'nodejs';

async function getAdminUserStats() {
  const usersCount = await prisma.user.count();
  const activeUsersCount = await prisma.user.count({ where: { status: 'ACTIVE' } });
  const suspendedUsersCount = await prisma.user.count({ where: { status: 'SUSPENDED' } });
  return {
    users: usersCount,
    currentUsers: usersCount,
    activeUsers: activeUsersCount,
    suspendedUsers: suspendedUsersCount,
    deletedUsers: 0,
    totalRows: usersCount
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  try {
    const userMetrics = await getAdminUserStats();
    const health = await getDatabaseHealth();
    const tables = await getTableSummary();

    return apiJson({
      engine: 'supabase',
      file: health.file,
      tables,
      userMetrics,
      health
    });
  } catch (error) {
    return safeServerError(error, 'Failed to retrieve database summary.');
  }
}
