import { prisma } from '@/lib/server/db';
import { apiJson, requireAdmin } from '@/lib/server/http';
import { hydrateCase } from '@/lib/server/case-helpers';
import { cachedDashboardStats } from '@/lib/server/cache';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  // Fetch cached stats from PostgreSQL/unstable_cache
  const stats = await cachedDashboardStats();

  // Fetch recent cases live (since they change frequently and require freshness)
  const recentCaseItems = await prisma.caseItem.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    include: {
      owner: true,
      images: true
    }
  });

  const recentCases = await Promise.all(
    recentCaseItems.map((item) => hydrateCase(item, true))
  );

  return apiJson({
    stats,
    recentCases
  });
}
