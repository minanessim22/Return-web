import { prisma } from '@/lib/server/db';

export async function upsertPotentialMatchesForCase(sourceCase: {
  id: string;
  type: string;
  category: string | null;
  gender: string | null;
  age: number | null;
  fullName: string | null;
  estimatedName: string | null;
}) {
  try {
    const targetType = sourceCase.type === 'MISSING' ? 'FOUND' : 'MISSING';
    const candidates = await prisma.caseItem.findMany({
      where: {
        type: targetType as any,
        status: { in: ['ACTIVE', 'UNDER_REVIEW'] },
        deletedAt: null,
        id: { not: sourceCase.id }
      }
    });

    for (const cand of candidates) {
      let score = 0.5;

      if (cand.category && sourceCase.category && cand.category.trim().toLowerCase() === sourceCase.category.trim().toLowerCase()) {
        score += 0.2;
      }
      if (cand.gender && sourceCase.gender && cand.gender.trim().toLowerCase() === sourceCase.gender.trim().toLowerCase()) {
        score += 0.1;
      }
      if (cand.age !== null && sourceCase.age !== null) {
        const ageDiff = Math.abs(cand.age - sourceCase.age);
        if (ageDiff <= 3) score += 0.2;
        else if (ageDiff <= 8) score += 0.1;
      }

      if (score >= 0.7) {
        const missingId = sourceCase.type === 'MISSING' ? sourceCase.id : cand.id;
        const foundId = sourceCase.type === 'MISSING' ? cand.id : sourceCase.id;

        const existing = await prisma.caseMatch.findFirst({
          where: { missingCaseId: missingId, foundCaseId: foundId }
        });

        if (!existing) {
          const match = await prisma.caseMatch.create({
            data: {
              missingCaseId: missingId,
              foundCaseId: foundId,
              score,
              source: 'db_heuristic',
              status: 'PENDING'
            }
          });

          // Create notifications for both owners if they exist
          const missingCaseRecord = await prisma.caseItem.findUnique({
            where: { id: missingId },
            include: { owner: true }
          });
          const foundCaseRecord = await prisma.caseItem.findUnique({
            where: { id: foundId },
            include: { owner: true }
          });

          if (missingCaseRecord?.ownerUserId) {
            await prisma.notification.create({
              data: {
                userId: missingCaseRecord.ownerUserId,
                title: 'Potential match detected',
                body: `A found report may match your missing report ${missingCaseRecord.fullName || 'Unknown'}.`,
                type: 'match',
                relatedCaseId: missingId
              }
            });
          }

          if (foundCaseRecord?.ownerUserId) {
            await prisma.notification.create({
              data: {
                userId: foundCaseRecord.ownerUserId,
                title: 'Potential match detected',
                body: `A missing report may match your found report ${foundCaseRecord.estimatedName || 'Unknown'}.`,
                type: 'match',
                relatedCaseId: foundId
              }
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[MatchHelpers] Error updating potential matches:', err);
  }
}
