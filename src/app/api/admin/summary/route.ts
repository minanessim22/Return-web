import { prisma } from '@/lib/server/db';
import { apiJson, requireAdmin } from '@/lib/server/http';
import { hydrateCase } from '@/lib/server/case-helpers';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  // Fetch stats from PostgreSQL
  const usersCount = await prisma.user.count();
  const activeUsersCount = await prisma.user.count({ where: { status: 'ACTIVE' } });
  const totalReports = await prisma.caseItem.count({ where: { deletedAt: null } });
  const missingReports = await prisma.caseItem.count({ where: { deletedAt: null, type: 'MISSING' } });
  const foundReports = await prisma.caseItem.count({ where: { deletedAt: null, type: 'FOUND' } });
  const openMatches = await prisma.caseMatch.count({ where: { status: 'PENDING' } });
  const confirmedMatches = await prisma.caseMatch.count({ where: { status: 'CONFIRMED' } });
  const devicesCount = await prisma.device.count({
    where: {
      type: { in: ['GPS', 'QR', 'NFC'] }
    }
  });
  const profilesCount = await prisma.identificationProfile.count();
  const conversationsCount = await prisma.conversation.count();
  const messagesCount = await prisma.message.count();

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
    stats: {
      users: usersCount,
      currentUsers: usersCount,
      activeUsers: activeUsersCount,
      deletedUsers: 0,
      totalReports,
      missingReports,
      foundReports,
      openMatches,
      confirmedMatches,
      devices: devicesCount,
      profiles: profilesCount,
      conversations: conversationsCount,
      messages: messagesCount
    },
    recentCases
  });
}
