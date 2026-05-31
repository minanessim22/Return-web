import { prisma } from '@/lib/server/db';
import { parseOptionalString } from '@/lib/server/security';
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
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true
      }
    });

    if (!conversation) {
      return apiError(404, 'NOT_FOUND');
    }

    const isParticipant = conversation.participants.some(p => p.userId === auth.user!.id);
    if (!isParticipant) {
      return apiError(403, 'FORBIDDEN');
    }

    const msgBody = parseOptionalString(body.body);
    if (!msgBody) {
      return apiError(400, 'EMPTY_MESSAGE');
    }

    const createdMessage = await prisma.message.create({
      data: {
        conversationId,
        senderUserId: auth.user.id,
        body: msgBody,
        messageType: 'TEXT'
      },
      include: {
        senderUser: true
      }
    });

    const item = {
      id: createdMessage.id,
      conversationId: createdMessage.conversationId,
      senderUserId: createdMessage.senderUserId,
      body: createdMessage.body,
      messageType: createdMessage.messageType,
      createdAt: createdMessage.createdAt.toISOString(),
      sender: createdMessage.senderUser ? {
        id: createdMessage.senderUser.id,
        name: createdMessage.senderUser.name,
        email: createdMessage.senderUser.email,
        avatarUrl: createdMessage.senderUser.avatarUrl,
        phone: createdMessage.senderUser.phone,
        username: createdMessage.senderUser.username,
        dateOfBirth: createdMessage.senderUser.dateOfBirth
      } : undefined,
      isMine: true
    };

    return apiJson({ item });
  } catch (error) {
    console.error('[AddMessage] Error:', error);
    return apiError(500, 'INTERNAL_SERVER_ERROR');
  }
}
