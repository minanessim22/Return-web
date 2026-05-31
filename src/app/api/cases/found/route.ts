import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { prisma } from '@/lib/server/db';
import {
  parseOptionalDate,
  parseOptionalNumber,
  parseOptionalString,
  inferCategory,
  ensureSameOrigin
} from '@/lib/server/security';
import { hydrateCase } from '@/lib/server/case-helpers';
import { upsertPotentialMatchesForCase } from '@/lib/server/match-helpers';

export const runtime = 'nodejs';

function isValidCoordinate(latitude?: number, longitude?: number) {
  if (latitude === undefined && longitude === undefined) return true;
  if (latitude === undefined || longitude === undefined) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

async function nextReferenceCode() {
  const cases = await prisma.caseItem.findMany({
    select: { referenceCode: true }
  });
  const codes = cases
    .map((item) => Number(String(item.referenceCode).replace(/[^0-9]/g, '')))
    .filter((value) => Number.isFinite(value));
  const next = Math.max(2000, ...codes) + 1;
  return `RTN-${next}`;
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
  const estimatedName = parseOptionalString(body.estimatedName ?? body.name) || 'Unknown person or item';
  const age = parseOptionalNumber(body.age);
  const locationText = parseOptionalString(body.locationText ?? body.location);
  const foundAtStr = parseOptionalDate(body.foundAt ?? body.dateTime);
  const foundAt = foundAtStr ? new Date(foundAtStr) : undefined;
  const description = parseOptionalString(body.description);
  const clothesColor = parseOptionalString(body.clothesColor);
  const latitude = parseOptionalNumber(body.latitude);
  const longitude = parseOptionalNumber(body.longitude);

  if (age === undefined) {
    return NextResponse.json({ error: 'Age is required for every report.' }, { status: 400 });
  }
  if (age < 0 || age > 120) {
    return NextResponse.json({ error: 'Age must be between 0 and 120.' }, { status: 400 });
  }
  if (!locationText) {
    return NextResponse.json({ error: 'Address / location is required for every report.' }, { status: 400 });
  }
  if (!foundAt) {
    return NextResponse.json({ error: 'Date / time is required for every report.' }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: 'Description is required for every report.' }, { status: 400 });
  }
  if (!clothesColor) {
    return NextResponse.json({ error: 'Clothes / visual notes are required for every report.' }, { status: 400 });
  }
  if (!isValidCoordinate(latitude, longitude)) {
    return NextResponse.json({ error: 'Please enter a valid map location.' }, { status: 400 });
  }

  const seedMatch = typeof body.seedMatch === 'object' && body.seedMatch ? body.seedMatch as Record<string, unknown> : undefined;

  const imageList = Array.isArray(body.images)
    ? body.images.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 4)
    : parseOptionalString(body.photo)
      ? [String(body.photo)]
      : [];

  const refCode = await nextReferenceCode();

  const createdCase = await prisma.caseItem.create({
    data: {
      ownerUserId: user.id,
      type: 'FOUND',
      status: 'UNDER_REVIEW',
      category: inferCategory(parseOptionalString(body.category) || parseOptionalString(body.type)),
      estimatedName,
      age,
      gender: parseOptionalString(body.gender),
      description,
      clothesColor,
      conditionNotes: parseOptionalString(body.conditionNotes),
      locationText,
      latitude,
      longitude,
      eventTime: foundAt,
      foundAt,
      referenceCode: refCode,
      images: {
        create: imageList.map((url: string, idx: number) => ({
          imageUrl: url,
          sortOrder: idx
        }))
      },
      statusHistory: {
        create: {
          status: 'UNDER_REVIEW',
          changedByUserId: user.id,
          note: 'Case created'
        }
      }
    },
    include: {
      owner: true,
      images: true
    }
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      title: 'Report saved',
      body: `${estimatedName} was saved as ${refCode}.`,
      type: 'case_created',
      relatedCaseId: createdCase.id
    }
  });

  // Run match heuristic
  await upsertPotentialMatchesForCase({
    id: createdCase.id,
    type: createdCase.type,
    category: createdCase.category,
    gender: createdCase.gender,
    age: createdCase.age,
    fullName: createdCase.fullName,
    estimatedName: createdCase.estimatedName
  });

  const otherCaseId = parseOptionalString(seedMatch?.otherCaseId);
  if (otherCaseId) {
    const existingMatch = await prisma.caseMatch.findFirst({
      where: {
        missingCaseId: otherCaseId,
        foundCaseId: createdCase.id
      }
    });

    if (!existingMatch) {
      const matchScore = parseOptionalNumber(seedMatch?.score) ?? 0.8;
      await prisma.caseMatch.create({
        data: {
          missingCaseId: otherCaseId,
          foundCaseId: createdCase.id,
          score: matchScore,
          source: 'ai_face_match',
          status: 'PENDING'
        }
      });

      // Get missing case to notify owner
      const missingCase = await prisma.caseItem.findUnique({
        where: { id: otherCaseId }
      });
      if (missingCase?.ownerUserId) {
        await prisma.notification.create({
          data: {
            userId: missingCase.ownerUserId,
            title: 'Possible match detected',
            body: `A found report may match ${missingCase.fullName || 'Unknown'}.`,
            type: 'match',
            relatedCaseId: missingCase.id
          }
        });
      }
    }
  }

  const hydrated = await hydrateCase(createdCase, true);

  return NextResponse.json({ item: hydrated }, { status: 201 });
}
