import { getAdminUserStats, readStore } from '@/lib/server/store';
import { getSqliteHealth, getSqliteSummary } from '@/lib/server/sqlite-db';
import { apiJson, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  const store = await readStore();

  return apiJson({
    engine: 'supabase',
    file: (await getSqliteHealth()).file,
    tables: await getSqliteSummary(),
    userMetrics: getAdminUserStats(store),
    health: await getSqliteHealth()
  });
}
