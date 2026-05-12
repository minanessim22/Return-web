import { addConversationMessage, updateStore } from '@/lib/server/store';
import { apiError, apiJson, enforceRateLimit, readJsonBody, requireSameOrigin, requireUser } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireUser();
  if (auth.response || !auth.user) {
    return auth.response!;
  }

  const { conversationId } = await context.params;
  const rateError = enforceRateLimit({
    request,
    user: auth.user,
    label: 'conversation-message',
    limit: 12,
    windowMs: 60 * 1000,
    extraKey: conversationId
  });
  if (rateError) {
    return rateError;
  }

  const body = await readJsonBody(request);

  try {
    let item: ReturnType<typeof addConversationMessage> | undefined;
    await updateStore((store) => {
      item = addConversationMessage(store, {
        conversationId,
        senderUserId: auth.user!.id,
        body: typeof body.body === 'string' ? body.body : ''
      });
    });
    return apiJson({ item });
  } catch (error) {
    if (error instanceof Error && ['NOT_FOUND', 'FORBIDDEN', 'EMPTY_MESSAGE'].includes(error.message)) {
      return apiError(
        error.message === 'NOT_FOUND' ? 404 : error.message === 'FORBIDDEN' ? 403 : 400,
        error.message
      );
    }
    throw error;
  }
}
