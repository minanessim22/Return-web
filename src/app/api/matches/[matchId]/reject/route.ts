import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { prisma } from '@/lib/server/db';
import { ensureSameOrigin } from '@/lib/server/security';
import { ensureConversationForMatch } from '@/lib/server/conversation-helpers';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const { matchId } = await context.params;

  try {
    const match = await prisma.caseMatch.findUnique({
      where: { id: matchId },
      include: {
        missingCase: true,
        foundCase: true
      }
    });

    if (!match || !match.missingCase || !match.foundCase || match.missingCase.deletedAt || match.foundCase.deletedAt) {
      return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
    }

    if (user.id !== match.missingCase.ownerUserId) {
      return NextResponse.json(
        { error: 'Only the missing report owner can reject the final confirmation.' },
        { status: 403 }
      );
    }

    if (!match.confirmationRequestedAt) {
      return NextResponse.json(
        { error: 'The finder must send a final confirmation request first.' },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Reject current match
      await tx.caseMatch.update({
        where: { id: matchId },
        data: { status: 'REJECTED' }
      });

      // 2. Sync missing case status if there are no more pending matches
      const missingPending = await tx.caseMatch.count({
        where: {
          status: 'PENDING',
          OR: [
            { missingCaseId: match.missingCaseId },
            { foundCaseId: match.missingCaseId }
          ]
        }
      });
      if (missingPending === 0 && match.missingCase.status === 'MATCHED') {
        await tx.caseItem.update({
          where: { id: match.missingCaseId },
          data: { status: 'ACTIVE' }
        });
        await tx.caseStatusHistory.create({
          data: {
            caseId: match.missingCaseId,
            status: 'ACTIVE',
            changedByUserId: user.id,
            note: 'Match cleared, status reverted to Active'
          }
        });
      }

      // 3. Sync found case status if there are no more pending matches
      const foundPending = await tx.caseMatch.count({
        where: {
          status: 'PENDING',
          OR: [
            { missingCaseId: match.foundCaseId },
            { foundCaseId: match.foundCaseId }
          ]
        }
      });
      if (foundPending === 0 && match.foundCase.status === 'MATCHED') {
        await tx.caseItem.update({
          where: { id: match.foundCaseId },
          data: { status: 'ACTIVE' }
        });
        await tx.caseStatusHistory.create({
          data: {
            caseId: match.foundCaseId,
            status: 'ACTIVE',
            changedByUserId: user.id,
            note: 'Match cleared, status reverted to Active'
          }
        });
      }
    });

    const conversation = await ensureConversationForMatch(matchId, user.id);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: user.id,
        body: 'Final match request declined by the missing report owner.',
        messageType: 'SYSTEM'
      }
    });

    if (match.foundCase.ownerUserId) {
      await prisma.notification.create({
        data: {
          userId: match.foundCase.ownerUserId,
          title: 'Final match declined',
          body: 'The missing report owner declined the final confirmation request.',
          type: 'match',
          relatedCaseId: match.missingCaseId
        }
      });
    }

    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    console.error('[RejectMatch] Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
