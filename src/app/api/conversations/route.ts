import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureConversationForMatch, getConversationDetailForUser, listConversationSummariesForUser } from '@/lib/server/conversation-helpers';
import { ensureSameOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const items = await listConversationSummariesForUser(user.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const matchId = typeof body.matchId === 'string' ? body.matchId : '';
  if (!matchId) {
    return NextResponse.json({ error: 'matchId is required.' }, { status: 400 });
  }

  try {
    const conversation = await ensureConversationForMatch(matchId, user.id);
    const detail = await getConversationDetailForUser(conversation.id, user.id);
    return NextResponse.json({ item: detail });
  } catch (error) {
    if (error instanceof Error && ['NOT_FOUND', 'FORBIDDEN'].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'NOT_FOUND' ? 404 : 403 });
    }
    console.error('[Conversations POST] Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
