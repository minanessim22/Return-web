import { apiError, apiJson, clampInteger, requireAdmin } from '@/lib/server/http';
import { readSqliteTable } from '@/lib/server/sqlite-db';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ table: string }> }) {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  const { table } = await context.params;
  const url = new URL(request.url);
  const limit = clampInteger(url.searchParams.get('limit'), 1, 200, 50);
  const offset = clampInteger(url.searchParams.get('offset'), 0, 10_000, 0);

  try {
    return apiJson(await readSqliteTable(table, limit, offset));
  } catch (error) {
    if (error instanceof Error && error.message === 'TABLE_NOT_FOUND') {
      return apiError(404, 'Table not found.');
    }
    throw error;
  }
}
