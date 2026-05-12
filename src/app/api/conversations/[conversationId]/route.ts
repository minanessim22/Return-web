import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { getConversationDetailForUser, readStore } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ conversationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const { conversationId } = await context.params;
  const store = await readStore();

  try {
    return NextResponse.json({ item: getConversationDetailForUser(store, conversationId, user.id) });
  } catch (error) {
    if (error instanceof Error && ['NOT_FOUND', 'FORBIDDEN'].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'NOT_FOUND' ? 404 : 403 });
    }
    throw error;
  }
}
