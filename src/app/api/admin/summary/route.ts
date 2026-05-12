import { buildAdminSummary, readStore } from '@/lib/server/store';
import { apiJson, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  const store = await readStore();
  return apiJson(buildAdminSummary(store));
}
