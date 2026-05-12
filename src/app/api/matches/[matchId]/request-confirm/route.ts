import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { requestMatchConfirmation, updateStore } from '@/lib/server/store';
import { ensureSameOrigin } from '@/lib/server/security';

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
    await updateStore((store) => {
      requestMatchConfirmation(store, { matchId, userId: user.id });
    });
    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    if (error instanceof Error && ['NOT_FOUND', 'FOUND_OWNER_ONLY'].includes(error.message)) {
      return NextResponse.json(
        {
          error: error.message === 'FOUND_OWNER_ONLY'
            ? 'Only the found report owner can send the final confirmation request.'
            : 'Match not found.'
        },
        { status: error.message === 'NOT_FOUND' ? 404 : 403 }
      );
    }
    throw error;
  }
}
