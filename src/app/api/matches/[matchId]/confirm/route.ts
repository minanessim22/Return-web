import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { confirmMatch, updateStore } from '@/lib/server/store';
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
      confirmMatch(store, { matchId, userId: user.id });
    });
    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    if (error instanceof Error && ['NOT_FOUND', 'MISSING_OWNER_ONLY', 'REQUEST_REQUIRED'].includes(error.message)) {
      return NextResponse.json(
        {
          error: error.message === 'MISSING_OWNER_ONLY'
            ? 'Only the missing report owner can make the final confirmation.'
            : error.message === 'REQUEST_REQUIRED'
              ? 'The finder must send a final confirmation request first.'
              : 'Match not found.'
        },
        { status: error.message === 'NOT_FOUND' ? 404 : error.message === 'REQUEST_REQUIRED' ? 409 : 403 }
      );
    }
    throw error;
  }
}
