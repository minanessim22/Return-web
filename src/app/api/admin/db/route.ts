import { getAdminUserStats, readStore } from '@/lib/server/store';
import { getSqliteHealth, listSqliteTables } from '@/lib/server/sqlite-db';
import { apiJson, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  const store = await readStore();

  return apiJson({
    engine: 'sqlite',
    file: getSqliteHealth().file,
    tables: listSqliteTables(),
    userMetrics: getAdminUserStats(store),
    health: getSqliteHealth()
  });
}
