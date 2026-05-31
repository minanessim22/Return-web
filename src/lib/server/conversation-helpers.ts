import { prisma } from '@/lib/server/db';

export async function ensureConversationForMatch(matchId: string, requesterUserId: string) {
  const match = await prisma.caseMatch.findUnique({
    where: { id: matchId },
    include: {
      missingCase: true,
      foundCase: true
    }
  });

  if (!match || !match.missingCase || !match.foundCase) {
    throw new Error('NOT_FOUND');
  }

  const missingOwner = match.missingCase.ownerUserId;
  const foundOwner = match.foundCase.ownerUserId;

  if (!missingOwner || !foundOwner) {
    throw new Error('NOT_FOUND');
  }

  if (requesterUserId !== missingOwner && requesterUserId !== foundOwner) {
    throw new Error('FORBIDDEN');
  }

  const participantIds = Array.from(new Set([missingOwner, foundOwner]));

  // Try to find an existing conversation between these participants for this missingCase
  const existing = await prisma.conversation.findFirst({
    where: {
      relatedCaseId: match.missingCaseId,
      AND: participantIds.map(userId => ({
        participants: {
          some: { userId }
        }
      }))
    },
    include: {
      participants: true
    }
  });

  if (existing) {
    return existing;
  }

  // Create new conversation
  const created = await prisma.conversation.create({
    data: {
      relatedCaseId: match.missingCaseId,
      createdByUserId: requesterUserId,
      participants: {
        create: participantIds.map(userId => ({ userId }))
      }
    },
    include: {
      participants: true
    }
  });

  return created;
}

export async function getConversationDetailForUser(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: true
        }
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          senderUser: true
        }
      },
      relatedCase: {
        include: {
          missingMatches: {
            include: {
              foundCase: true
            }
          },
          foundMatches: {
            include: {
              missingCase: true
            }
          }
        }
      }
    }
  });

  if (!conversation) {
    throw new Error('NOT_FOUND');
  }

  const isParticipant = conversation.participants.some(p => p.userId === userId);
  if (!isParticipant) {
    throw new Error('FORBIDDEN');
  }

  // Find the other case if it's a match conversation
  let otherCaseName = '';
  const caseIds: string[] = [];
  if (conversation.relatedCase) {
    caseIds.push(conversation.relatedCase.id);
    const relatedCase = conversation.relatedCase;
    const match = (relatedCase.missingMatches[0] || relatedCase.foundMatches[0]) as any;
    if (match) {
      const otherCase = match.foundCaseId === relatedCase.id ? match.missingCase : match.foundCase;
      if (otherCase) {
        caseIds.push(otherCase.id);
        otherCaseName = otherCase.fullName || otherCase.estimatedName || 'Unknown';
      }
    }
  }

  const relatedCaseName = conversation.relatedCase?.fullName || conversation.relatedCase?.estimatedName || 'Case';
  const title = otherCaseName ? `${relatedCaseName} ↔ ${otherCaseName}` : `Conversation about ${relatedCaseName}`;

  const participantsPreview = conversation.participants.map(p => ({
    id: p.user.id,
    name: p.user.name,
    email: p.user.email,
    avatarUrl: p.user.avatarUrl,
    phone: p.user.phone,
    username: p.user.username,
    dateOfBirth: p.user.dateOfBirth
  }));

  const messagesHydrated = conversation.messages.map(msg => ({
    id: msg.id,
    conversationId: msg.conversationId,
    senderUserId: msg.senderUserId,
    body: msg.body,
    messageType: msg.messageType,
    createdAt: msg.createdAt.toISOString(),
    sender: msg.senderUser ? {
      id: msg.senderUser.id,
      name: msg.senderUser.name,
      email: msg.senderUser.email,
      avatarUrl: msg.senderUser.avatarUrl,
      phone: msg.senderUser.phone,
      username: msg.senderUser.username,
      dateOfBirth: msg.senderUser.dateOfBirth
    } : undefined,
    isMine: msg.senderUserId === userId
  }));

  const lastMessage = messagesHydrated[messagesHydrated.length - 1];

  return {
    id: conversation.id,
    title,
    relatedCaseId: conversation.relatedCaseId,
    relatedMatchId: null,
    caseIds,
    participants: participantsPreview,
    messages: messagesHydrated,
    lastMessage,
    unreadCount: 0,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.createdAt.toISOString()
  };
}

export async function listConversationSummariesForUser(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId }
      }
    },
    include: {
      participants: {
        include: {
          user: true
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          senderUser: true
        }
      },
      relatedCase: {
        include: {
          missingMatches: {
            include: {
              foundCase: true
            }
          },
          foundMatches: {
            include: {
              missingCase: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const summaries = [];
  for (const conversation of conversations) {
    let otherCaseName = '';
    const caseIds: string[] = [];
    if (conversation.relatedCase) {
      caseIds.push(conversation.relatedCase.id);
      const relatedCase = conversation.relatedCase;
      const match = (relatedCase.missingMatches[0] || relatedCase.foundMatches[0]) as any;
      if (match) {
        const otherCase = match.foundCaseId === relatedCase.id ? match.missingCase : match.foundCase;
        if (otherCase) {
          caseIds.push(otherCase.id);
          otherCaseName = otherCase.fullName || otherCase.estimatedName || 'Unknown';
        }
      }
    }

    const relatedCaseName = conversation.relatedCase?.fullName || conversation.relatedCase?.estimatedName || 'Case';
    const title = otherCaseName ? `${relatedCaseName} ↔ ${otherCaseName}` : `Conversation about ${relatedCaseName}`;

    const participantsPreview = conversation.participants.map(p => ({
      id: p.user.id,
      name: p.user.name,
      email: p.user.email,
      avatarUrl: p.user.avatarUrl,
      phone: p.user.phone,
      username: p.user.username,
      dateOfBirth: p.user.dateOfBirth
    }));

    const lastMsg = conversation.messages[0];
    const lastMessageHydrated = lastMsg ? {
      id: lastMsg.id,
      conversationId: lastMsg.conversationId,
      senderUserId: lastMsg.senderUserId,
      body: lastMsg.body,
      messageType: lastMsg.messageType,
      createdAt: lastMsg.createdAt.toISOString(),
      sender: lastMsg.senderUser ? {
        id: lastMsg.senderUser.id,
        name: lastMsg.senderUser.name,
        email: lastMsg.senderUser.email,
        avatarUrl: lastMsg.senderUser.avatarUrl,
        phone: lastMsg.senderUser.phone,
        username: lastMsg.senderUser.username,
        dateOfBirth: lastMsg.senderUser.dateOfBirth
      } : undefined,
      isMine: lastMsg.senderUserId === userId
    } : undefined;

    summaries.push({
      id: conversation.id,
      title,
      relatedCaseId: conversation.relatedCaseId,
      relatedMatchId: null,
      caseIds,
      participants: participantsPreview,
      lastMessage: lastMessageHydrated,
      unreadCount: 0,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.createdAt.toISOString()
    });
  }

  return summaries;
}
