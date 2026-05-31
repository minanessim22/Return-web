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
  const fullName = parseOptionalString(body.fullName ?? body.name);
  const age = parseOptionalNumber(body.age);
  const locationText = parseOptionalString(body.locationText ?? body.location);
  const eventTimeStr = parseOptionalDate(body.lastSeenAt ?? body.dateTime);
  const eventTime = eventTimeStr ? new Date(eventTimeStr) : undefined;
  const description = parseOptionalString(body.description);
  const clothesColor = parseOptionalString(body.clothesColor);
  const latitude = parseOptionalNumber(body.latitude);
  const longitude = parseOptionalNumber(body.longitude);

  if (!fullName) {
    return NextResponse.json({ error: 'Please enter the missing person or item name.' }, { status: 400 });
  }
  if (age === undefined) {
    return NextResponse.json({ error: 'Age is required for every report.' }, { status: 400 });
  }
  if (age < 0 || age > 120) {
    return NextResponse.json({ error: 'Age must be between 0 and 120.' }, { status: 400 });
  }
  if (!locationText) {
    return NextResponse.json({ error: 'Address / location is required for every report.' }, { status: 400 });
  }
  if (!eventTime) {
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

  const imageList = Array.isArray(body.images)
    ? body.images.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 4)
    : parseOptionalString(body.photo)
      ? [String(body.photo)]
      : [];

  const refCode = await nextReferenceCode();

  const createdCase = await prisma.caseItem.create({
    data: {
      ownerUserId: user.id,
      type: 'MISSING',
      status: 'ACTIVE',
      category: inferCategory(parseOptionalString(body.category) || parseOptionalString(body.type)),
      fullName,
      age,
      gender: parseOptionalString(body.gender),
      description,
      clothesColor,
      contactPhone: parseOptionalString(body.contactPhone) || user.phone,
      locationText,
      latitude,
      longitude,
      eventTime,
      lastSeenAt: eventTime,
      referenceCode: refCode,
      images: {
        create: imageList.map((url: string, idx: number) => ({
          imageUrl: url,
          sortOrder: idx
        }))
      },
      statusHistory: {
        create: {
          status: 'ACTIVE',
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
      body: `${fullName} was saved as ${refCode}.`,
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

  const hydrated = await hydrateCase(createdCase, true);

  return NextResponse.json({ item: hydrated }, { status: 201 });
}
