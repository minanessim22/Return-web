import { prisma } from '@/lib/server/db';
import type { Prisma } from '@prisma/client';

/** Person-related categories that require strict gender/age matching */
const PERSON_CATEGORIES = new Set([
  'child', 'elderly', 'adult male', 'adult female',
  'person', 'people', 'man', 'woman'
]);

function isPersonCategory(category: string | null | undefined): boolean {
  if (!category) return true; // default "child" — treat as person
  return PERSON_CATEGORIES.has(category.trim().toLowerCase());
}

function normalizeGender(gender: string | null | undefined): string | undefined {
  if (!gender) return undefined;
  const g = gender.trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === 'ذكر') return 'male';
  if (g === 'female' || g === 'f' || g === 'أنثى') return 'female';
  return g;
}

/**
 * Maximum allowed age gap for automatic heuristic matching.
 * Any pair exceeding this gap is immediately disqualified.
 */
const MAX_AGE_GAP = 10;

/**
 * Minimum score required to create a CaseMatch record.
 */
const MIN_MATCH_THRESHOLD = 0.7;

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
    const sourceIsPerson = isPersonCategory(sourceCase.category);
    const sourceGender = normalizeGender(sourceCase.gender);

    // ── Build filtered Prisma query with hard constraints ──
    const whereClause: Prisma.CaseItemWhereInput = {
      type: targetType as any,
      status: { in: ['ACTIVE', 'UNDER_REVIEW'] },
      deletedAt: null,
      id: { not: sourceCase.id }
    };

    // Hard filter: gender must match for person cases (when both are known)
    if (sourceIsPerson && sourceGender) {
      whereClause.OR = [
        { gender: { equals: sourceCase.gender, mode: 'insensitive' } },
        { gender: null } // allow null gender through, but penalize in scoring
      ];
    }

    // Hard filter: age must be within MAX_AGE_GAP range (when known)
    if (sourceIsPerson && sourceCase.age !== null && sourceCase.age !== undefined) {
      whereClause.AND = [
        {
          OR: [
            {
              age: {
                gte: sourceCase.age - MAX_AGE_GAP,
                lte: sourceCase.age + MAX_AGE_GAP
              }
            },
            { age: null } // allow null age through, but penalize in scoring
          ]
        }
      ];
    }

    const candidates = await prisma.caseItem.findMany({
      where: whereClause
    });

    for (const cand of candidates) {
      const candIsPerson = isPersonCategory(cand.category);
      const candGender = normalizeGender(cand.gender);
      const bothPerson = sourceIsPerson && candIsPerson;

      // ── Hard disqualification checks for person-type cases ──
      if (bothPerson) {
        // REJECT: different genders (both known)
        if (sourceGender && candGender && sourceGender !== candGender) {
          continue;
        }

        // REJECT: age gap too large (both known)
        if (sourceCase.age !== null && cand.age !== null) {
          const ageDiff = Math.abs(cand.age - sourceCase.age);
          if (ageDiff > MAX_AGE_GAP) {
            continue;
          }
        }
      }

      // ── Scoring (starts low, must earn its way up) ──
      let score = 0.3;

      // Category match: +0.2 (exact) or +0.1 (person family match)
      if (cand.category && sourceCase.category) {
        if (cand.category.trim().toLowerCase() === sourceCase.category.trim().toLowerCase()) {
          score += 0.2;
        } else if (bothPerson) {
          score += 0.1;
        }
      }

      // Gender match: +0.2 (critical for person cases)
      if (sourceGender && candGender) {
        if (sourceGender === candGender) {
          score += 0.2;
        }
        // Different gender already filtered out above for person cases
      } else if (bothPerson) {
        // One or both genders unknown — small penalty (uncertainty)
        score += 0.05;
      }

      // Age match: +0.2 (close) / +0.15 (moderate) / +0.05 (far)
      if (cand.age !== null && sourceCase.age !== null) {
        const ageDiff = Math.abs(cand.age - sourceCase.age);
        if (ageDiff <= 2) {
          score += 0.2;
        } else if (ageDiff <= 5) {
          score += 0.15;
        } else if (ageDiff <= MAX_AGE_GAP) {
          score += 0.05;
        }
      } else if (bothPerson) {
        // One or both ages unknown — small penalty (uncertainty)
        score += 0.03;
      }

      // Name similarity bonus: +0.1
      const sourceName = (sourceCase.fullName || sourceCase.estimatedName || '').trim().toLowerCase();
      const candName = (cand.fullName || cand.estimatedName || '').trim().toLowerCase();
      if (sourceName && candName && sourceName.length >= 2 && candName.length >= 2) {
        if (sourceName === candName) {
          score += 0.1;
        } else if (sourceName.includes(candName) || candName.includes(sourceName)) {
          score += 0.05;
        }
      }

      if (score >= MIN_MATCH_THRESHOLD) {
        const missingId = sourceCase.type === 'MISSING' ? sourceCase.id : cand.id;
        const foundId = sourceCase.type === 'MISSING' ? cand.id : sourceCase.id;

        const existing = await prisma.caseMatch.findFirst({
          where: { missingCaseId: missingId, foundCaseId: foundId }
        });

        if (!existing) {
          await prisma.caseMatch.create({
            data: {
              missingCaseId: missingId,
              foundCaseId: foundId,
              score: Number(score.toFixed(2)),
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
