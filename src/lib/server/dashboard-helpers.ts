import { prisma } from '@/lib/server/db';

export async function buildMyStats(userId: string) {
  const reportsCount = await prisma.caseItem.count({
    where: { ownerUserId: userId, deletedAt: null }
  });
  const devicesCount = await prisma.device.count({
    where: { ownerUserId: userId }
  });
  const profilesCount = await prisma.identificationProfile.count({
    where: { ownerUserId: userId }
  });
  return { reports: reportsCount, devices: devicesCount, profiles: profilesCount };
}

export async function buildDashboardSummary(userId: string) {
  const ownedCases = await prisma.caseItem.findMany({
    where: { ownerUserId: userId, deletedAt: null },
    include: { images: true },
    orderBy: { createdAt: 'desc' }
  });

  const devicesCount = await prisma.device.count({
    where: { ownerUserId: userId }
  });
  const profilesCount = await prisma.identificationProfile.count({
    where: { ownerUserId: userId }
  });
  const unreadNotificationsCount = await prisma.notification.count({
    where: { userId, isRead: false }
  });

  const stats = {
    totalReports: ownedCases.length,
    missingReports: ownedCases.filter((item) => item.type === 'MISSING').length,
    foundReports: ownedCases.filter((item) => item.type === 'FOUND').length,
    activeReports: ownedCases.filter((item) => item.status === 'ACTIVE' || item.status === 'UNDER_REVIEW').length,
    matchedReports: ownedCases.filter((item) => item.status === 'MATCHED' || item.status === 'RESOLVED' || item.status === 'CLOSED').length,
    resolvedReports: ownedCases.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length,
    devices: devicesCount,
    profiles: profilesCount,
    unreadNotifications: unreadNotificationsCount
  };

  // Limit recent cases to 5
  const recentCases = ownedCases.slice(0, 5).map((item) => ({
    id: item.id,
    referenceCode: item.referenceCode,
    type: item.type,
    status: item.status,
    fullName: item.fullName,
    estimatedName: item.estimatedName,
    age: item.age,
    gender: item.gender,
    description: item.description,
    createdAt: item.createdAt.toISOString(),
    images: item.images.map((img) => ({ id: img.id, imageUrl: img.imageUrl }))
  }));

  return { stats, recentCases };
}
