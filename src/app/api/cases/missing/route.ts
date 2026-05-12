import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import {
  createCaseRecord,
  hydrateCase,
  inferCategory,
  parseOptionalDate,
  parseOptionalNumber,
  parseOptionalString,
  readStore,
  updateStore,
  upsertPotentialMatchesForCaseAsync
} from '@/lib/server/store';
import { ensureSameOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';

function isValidCoordinate(latitude?: number, longitude?: number) {
  if (latitude === undefined && longitude === undefined) return true;
  if (latitude === undefined || longitude === undefined) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
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
  const eventTime = parseOptionalDate(body.lastSeenAt ?? body.dateTime);
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

  let createdId = '';
  await updateStore(async (store) => {
    const images = Array.isArray(body.images)
      ? body.images.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 4)
      : parseOptionalString(body.photo)
        ? [String(body.photo)]
        : [];

    const created = createCaseRecord(store, {
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
      images,
      aiAnalysis: typeof body.aiAnalysis === 'object' && body.aiAnalysis ? body.aiAnalysis : undefined,
      skipAutoMatch: true
    });
    createdId = created.id;
    await upsertPotentialMatchesForCaseAsync(store, created);
  });

  const store = await readStore();
  const created = store.cases.find((item) => item.id === createdId);
  if (!created) {
    return NextResponse.json({ error: 'Unable to create the case.' }, { status: 500 });
  }

  return NextResponse.json({ item: hydrateCase(created, store, true) }, { status: 201 });
}
