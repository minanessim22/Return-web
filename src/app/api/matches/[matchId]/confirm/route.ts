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
        { error: 'Only the missing report owner can make the final confirmation.' },
        { status: 403 }
      );
    }

    if (!match.confirmationRequestedAt) {
      return NextResponse.json(
        { error: 'The finder must send a final confirmation request first.' },
        { status: 409 }
      );
    }

    // Perform database updates in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Confirm current match
      await tx.caseMatch.update({
        where: { id: matchId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          confirmedByUserId: user.id
        }
      });

      // 2. Reject other pending matches for either of these cases
      await tx.caseMatch.updateMany({
        where: {
          id: { not: matchId },
          status: 'PENDING',
          OR: [
            { missingCaseId: match.missingCaseId },
            { foundCaseId: match.missingCaseId },
            { missingCaseId: match.foundCaseId },
            { foundCaseId: match.foundCaseId }
          ]
        },
        data: {
          status: 'REJECTED'
        }
      });

      // 3. Update missing case status to CLOSED
      await tx.caseItem.update({
        where: { id: match.missingCaseId },
        data: { status: 'CLOSED' }
      });
      await tx.caseStatusHistory.create({
        data: {
          caseId: match.missingCaseId,
          status: 'CLOSED',
          changedByUserId: user.id,
          note: 'Final match confirmed and missing report closed'
        }
      });

      // 4. Update found case status to RESOLVED
      await tx.caseItem.update({
        where: { id: match.foundCaseId },
        data: { status: 'RESOLVED' }
      });
      await tx.caseStatusHistory.create({
        data: {
          caseId: match.foundCaseId,
          status: 'RESOLVED',
          changedByUserId: user.id,
          note: 'Final match confirmed and found report resolved'
        }
      });
    });

    // 5. Ensure conversation and add system message
    const conversation = await ensureConversationForMatch(matchId, user.id);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: user.id,
        body: 'Final match confirmed by the missing report owner. The missing report was closed and the linked found report remains saved.',
        messageType: 'SYSTEM'
      }
    });

    // 6. Create notification for the found case owner (finder)
    if (match.foundCase.ownerUserId) {
      await prisma.notification.create({
        data: {
          userId: match.foundCase.ownerUserId,
          title: 'Final match confirmed',
          body: 'The missing report owner approved the match. The missing report was closed and the linked found report remains saved.',
          type: 'match',
          relatedCaseId: match.missingCaseId
        }
      });
    }

    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    console.error('[ConfirmMatch] Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
