import { unstable_cache, revalidateTag } from 'next/cache';
import { prisma } from './db';

/**
 * Fetch and cache general dashboard/admin counts.
 * Cached for 60 seconds.
 */
export const cachedDashboardStats = unstable_cache(
  async () => {
    const [
      users,
      activeUsers,
      totalReports,
      missingReports,
      foundReports,
      openMatches,
      confirmedMatches,
      devices,
      profiles,
      conversations,
      messages
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.caseItem.count({ where: { deletedAt: null } }),
      prisma.caseItem.count({ where: { deletedAt: null, type: 'MISSING' } }),
      prisma.caseItem.count({ where: { deletedAt: null, type: 'FOUND' } }),
      prisma.caseMatch.count({ where: { status: 'PENDING' } }),
      prisma.caseMatch.count({ where: { status: 'CONFIRMED' } }),
      prisma.device.count({ where: { type: { in: ['GPS', 'QR', 'NFC'] } } }),
      prisma.identificationProfile.count(),
      prisma.conversation.count(),
      prisma.message.count()
    ]);

    return {
      users,
      currentUsers: users,
      activeUsers,
      deletedUsers: 0,
      totalReports,
      missingReports,
      foundReports,
      openMatches,
      confirmedMatches,
      devices,
      profiles,
      conversations,
      messages
    };
  },
  ['dashboard-stats'],
  { revalidate: 60, tags: ['dashboard'] }
);

/**
 * Fetch and cache public case items list query.
 * Cached for 30 seconds.
 * 
 * We stringify and pass the where and orderBy structures to differentiate caches.
 */
export async function getCachedPublicCases(params: {
  where: Record<string, any>;
  orderBy: Record<string, any>;
  skip: number;
  take: number;
}) {
  // Create a stable cache key hash based on the parameters
  const cacheKey = JSON.stringify(params);
  
  const fetcher = unstable_cache(
    async () => {
      const total = await prisma.caseItem.count({ where: params.where });
      const cases = await prisma.caseItem.findMany({
        where: params.where,
        include: {
          images: true,
          owner: true
        },
        orderBy: params.orderBy,
        skip: params.skip,
        take: params.take
      });
      return { total, cases };
    },
    ['public-cases-feed', cacheKey],
    { revalidate: 30, tags: ['public-cases'] }
  );

  return fetcher();
}

/**
 * Invalidate the dashboard stats cache.
 */
export function invalidateDashboardCache() {
  try {
    revalidateTag('dashboard');
  } catch (err) {
    console.warn('[Cache] Could not revalidate tag dashboard:', err);
  }
}

/**
 * Invalidate the public cases feed cache.
 */
export function invalidatePublicCasesCache() {
  try {
    revalidateTag('public-cases');
  } catch (err) {
    console.warn('[Cache] Could not revalidate tag public-cases:', err);
  }
}
