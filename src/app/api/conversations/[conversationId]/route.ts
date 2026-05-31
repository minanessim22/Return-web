import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { getConversationDetailForUser } from '@/lib/server/conversation-helpers';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ conversationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const { conversationId } = await context.params;

  try {
    const detail = await getConversationDetailForUser(conversationId, user.id);
    return NextResponse.json({ item: detail });
  } catch (error) {
    if (error instanceof Error && ['NOT_FOUND', 'FORBIDDEN'].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'NOT_FOUND' ? 404 : 403 });
    }
    console.error('[Conversation Detail GET] Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
