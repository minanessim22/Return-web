import { prisma } from '@/lib/server/db';

export async function getHydratedMatches(caseId: string) {
  const matches = await prisma.caseMatch.findMany({
    where: {
      OR: [
        { missingCaseId: caseId },
        { foundCaseId: caseId }
      ]
    },
    include: {
      missingCase: {
        include: {
          owner: true,
          images: true
        }
      },
      foundCase: {
        include: {
          owner: true,
          images: true
        }
      }
    }
  });

  const hydrated = [];
  for (const item of matches) {
    const isMissing = item.missingCaseId === caseId;
    const otherCase = isMissing ? item.foundCase : item.missingCase;
    if (!otherCase || otherCase.deletedAt) continue;

    // Check if conversation exists
    const conversation = await prisma.conversation.findFirst({
      where: {
        relatedCaseId: otherCase.id
      }
    });

    hydrated.push({
      id: item.id,
      score: item.score,
      status: item.status,
      otherCaseId: otherCase.id,
      otherCaseReferenceCode: otherCase.referenceCode,
      otherCaseDisplayName: otherCase.fullName || otherCase.estimatedName || 'Unknown Case',
      otherCaseType: otherCase.type,
      otherCaseStatus: otherCase.status,
      otherCasePrimaryImage: otherCase.images?.[0]?.imageUrl || undefined,
      otherCaseOwner: otherCase.owner ? {
        id: otherCase.owner.id,
        name: otherCase.owner.name,
        email: otherCase.owner.email,
        avatarUrl: otherCase.owner.avatarUrl,
        phone: otherCase.owner.phone
      } : undefined,
      conversationId: conversation?.id || undefined,
      createdAt: item.createdAt.toISOString()
    });
  }

  return hydrated.sort((a, b) => b.score - a.score);
}

export async function hydrateCase(item: any, includeMatches = false) {
  const owner = item.owner;
  const matches = includeMatches ? await getHydratedMatches(item.id) : [];

  return {
    id: item.id,
    ownerUserId: item.ownerUserId,
    referenceCode: item.referenceCode,
    type: item.type,
    status: item.status,
    category: item.category,
    fullName: item.fullName,
    estimatedName: item.estimatedName,
    displayName: item.fullName || item.estimatedName || 'Unknown Case',
    age: item.age,
    gender: item.gender,
    description: item.description,
    clothesColor: item.clothesColor,
    conditionNotes: item.conditionNotes,
    contactPhone: item.contactPhone,
    locationText: item.locationText,
    latitude: item.latitude,
    longitude: item.longitude,
    eventTime: item.eventTime ? item.eventTime.toISOString() : undefined,
    lastSeenAt: item.lastSeenAt ? item.lastSeenAt.toISOString() : undefined,
    foundAt: item.foundAt ? item.foundAt.toISOString() : undefined,
    resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    primaryImage: item.images?.[0]?.imageUrl || undefined,
    images: item.images?.map((img: any) => ({ id: img.id, imageUrl: img.imageUrl })) || [],
    owner: owner ? {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      avatarUrl: owner.avatarUrl,
      phone: owner.phone,
      username: owner.username
    } : undefined,
    matches
  };
}
