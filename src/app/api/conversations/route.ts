import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureConversationForMatch, getConversationDetailForUser, listConversationSummariesForUser, readStore, updateStore } from '@/lib/server/store';
import { ensureSameOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const store = await readStore();
  return NextResponse.json({ items: listConversationSummariesForUser(store, user.id) });
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
    await updateStore((store) => {
      ensureConversationForMatch(store, { matchId, requesterUserId: user.id });
    });
    const store = await readStore();
    const conversation = ensureConversationForMatch(store, { matchId, requesterUserId: user.id });
    return NextResponse.json({ item: getConversationDetailForUser(store, conversation.id, user.id) });
  } catch (error) {
    if (error instanceof Error && ['NOT_FOUND', 'FORBIDDEN'].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'NOT_FOUND' ? 404 : 403 });
    }
    throw error;
  }
}
