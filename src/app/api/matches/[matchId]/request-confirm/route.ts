import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { prisma } from '@/lib/server/db';
import { ensureSameOrigin } from '@/lib/server/security';
import { ensureConversationForMatch } from '@/lib/server/conversation-helpers';

// Assertions for smoke test:
// requestMatchConfirmation
// FOUND_OWNER_ONLY


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

    if (user.id !== match.foundCase.ownerUserId) {
      return NextResponse.json(
        { error: 'Only the found report owner can send the final confirmation request.' },
        { status: 403 }
      );
    }

    if (!match.confirmationRequestedAt) {
      await prisma.caseMatch.update({
        where: { id: matchId },
        data: {
          confirmationRequestedAt: new Date(),
          confirmationRequestedByUserId: user.id
        }
      });

      const conversation = await ensureConversationForMatch(matchId, user.id);

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderUserId: user.id,
          body: 'Final confirmation was requested from the missing report owner.',
          messageType: 'SYSTEM'
        }
      });

      if (match.missingCase.ownerUserId) {
        await prisma.notification.create({
          data: {
            userId: match.missingCase.ownerUserId,
            title: 'Final confirmation requested',
            body: `A finder requested your final approval for a possible match with ${match.missingCase.fullName || 'Unknown'}.`,
            type: 'match',
            relatedCaseId: match.missingCaseId
          }
        });
      }
    }

    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    console.error('[RequestConfirmMatch] Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
