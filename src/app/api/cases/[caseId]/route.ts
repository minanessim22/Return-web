import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import {
  createId,
  createNotification,
  ensureCanManageCase,
  hydrateCase,
  parseOptionalDate,
  parseOptionalNumber,
  parseOptionalString,
  readStore,
  updateStore,
  upsertPotentialMatchesForCaseAsync
} from '@/lib/server/store';
import { ensureSameOrigin } from '@/lib/server/security';
import type { CaseStatus } from '@/lib/shared-types';

export const runtime = 'nodejs';

const validStatuses: CaseStatus[] = ['DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'MATCHED', 'RESOLVED', 'CLOSED'];

function isValidCoordinate(latitude?: number, longitude?: number) {
  if (latitude === undefined && longitude === undefined) return true;
  if (latitude === undefined || longitude === undefined) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const store = await readStore();
  const item = store.cases.find((entry) => entry.id === caseId && !entry.deletedAt);

  if (!item) {
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  }

  return NextResponse.json({ item: hydrateCase(item, store, true) });
}

export async function PUT(request: Request, context: { params: Promise<{ caseId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    await updateStore(async (store) => {
      const item = store.cases.find((entry) => entry.id === caseId && !entry.deletedAt);
      if (!item) {
        throw new Error('NOT_FOUND');
      }
      if (!ensureCanManageCase(item, user)) {
        throw new Error('FORBIDDEN');
      }

      const nextStatusRaw = parseOptionalString(body.status);
      const finalAge = parseOptionalNumber(body.age) ?? item.age;
      const finalLocationText = parseOptionalString(body.locationText ?? body.location) ?? item.locationText;
      const finalDescription = parseOptionalString(body.description) ?? item.description;
      const finalClothesColor = parseOptionalString(body.clothesColor) ?? item.clothesColor;
      const finalEventTime = parseOptionalDate(body.eventTime ?? body.dateTime) ?? parseOptionalDate(body.lastSeenAt ?? body.dateTime) ?? parseOptionalDate(body.foundAt ?? body.dateTime) ?? item.eventTime ?? item.lastSeenAt ?? item.foundAt;
      if (finalAge === undefined) {
        throw new Error('MISSING_REQUIRED_AGE');
      }
      if (!finalLocationText) {
        throw new Error('MISSING_REQUIRED_LOCATION');
      }
      if (!finalEventTime) {
        throw new Error('MISSING_REQUIRED_DATE');
      }
      if (!finalDescription) {
        throw new Error('MISSING_REQUIRED_DESCRIPTION');
      }
      if (!finalClothesColor) {
        throw new Error('MISSING_REQUIRED_CLOTHES');
      }
      const nextStatus = validStatuses.includes((nextStatusRaw || '') as CaseStatus) ? (nextStatusRaw as CaseStatus) : undefined;
      const nextLatitude = parseOptionalNumber(body.latitude);
      const nextLongitude = parseOptionalNumber(body.longitude);
      if (!isValidCoordinate(nextLatitude, nextLongitude)) {
        throw new Error('INVALID_COORDINATES');
      }
      const nextAge = parseOptionalNumber(body.age);
      if (nextAge !== undefined && (nextAge < 0 || nextAge > 120)) {
        throw new Error('INVALID_AGE');
      }
      const nextImages = Array.isArray(body.images)
        ? body.images.filter((image: unknown): image is string => typeof image === 'string' && image.trim().length > 0).slice(0, 4)
        : undefined;

      item.fullName = parseOptionalString(body.fullName ?? body.name) ?? item.fullName;
      item.estimatedName = parseOptionalString(body.estimatedName) ?? item.estimatedName;
      item.category = parseOptionalString(body.category ?? body.type) ?? item.category;
      item.age = nextAge ?? item.age;
      item.gender = parseOptionalString(body.gender) ?? item.gender;
      item.description = parseOptionalString(body.description) ?? item.description;
      item.clothesColor = parseOptionalString(body.clothesColor) ?? item.clothesColor;
      item.conditionNotes = parseOptionalString(body.conditionNotes) ?? item.conditionNotes;
      item.contactPhone = parseOptionalString(body.contactPhone) ?? item.contactPhone;
      item.locationText = parseOptionalString(body.locationText ?? body.location) ?? item.locationText;
      item.latitude = nextLatitude ?? item.latitude;
      item.longitude = nextLongitude ?? item.longitude;
      item.eventTime = parseOptionalDate(body.eventTime ?? body.dateTime) ?? item.eventTime;
      item.lastSeenAt = parseOptionalDate(body.lastSeenAt ?? body.dateTime) ?? item.lastSeenAt;
      item.foundAt = parseOptionalDate(body.foundAt ?? body.dateTime) ?? item.foundAt;
      if (nextStatus && nextStatus !== item.status) {
        item.status = nextStatus;
        item.statusHistory.unshift({
          id: createId('history'),
          status: nextStatus,
          changedByUserId: user.id,
          note: 'Case updated from dashboard',
          createdAt: new Date().toISOString()
        });
      }
      if (nextImages !== undefined) {
        item.images = nextImages.map((imageUrl: string, index: number) => ({
          id: createId('img'),
          imageUrl,
          sortOrder: index,
          createdAt: new Date().toISOString()
        }));
      }
      if (typeof body.photo === 'string' && body.photo.trim()) {
        item.images = [{
          id: createId('img'),
          imageUrl: body.photo.trim(),
          sortOrder: 0,
          createdAt: new Date().toISOString()
        }];
      }
      if ('aiAnalysis' in body) {
        item.aiAnalysis = typeof body.aiAnalysis === 'object' && body.aiAnalysis ? body.aiAnalysis : undefined;
      }
      item.updatedAt = new Date().toISOString();
      await upsertPotentialMatchesForCaseAsync(store, item);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'You do not have access to edit this case.' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'INVALID_COORDINATES') {
      return NextResponse.json({ error: 'Please enter a valid map location.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'INVALID_AGE') {
      return NextResponse.json({ error: 'Age must be between 0 and 120.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'MISSING_REQUIRED_AGE') {
      return NextResponse.json({ error: 'Age is required for every report.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'MISSING_REQUIRED_LOCATION') {
      return NextResponse.json({ error: 'Address / location is required for every report.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'MISSING_REQUIRED_DATE') {
      return NextResponse.json({ error: 'Date / time is required for every report.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'MISSING_REQUIRED_DESCRIPTION') {
      return NextResponse.json({ error: 'Description is required for every report.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'MISSING_REQUIRED_CLOTHES') {
      return NextResponse.json({ error: 'Clothes / visual notes are required for every report.' }, { status: 400 });
    }
    throw error;
  }

  const store = await readStore();
  const updated = store.cases.find((entry) => entry.id === caseId && !entry.deletedAt);
  if (!updated) {
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  }

  return NextResponse.json({ item: hydrateCase(updated, store, true) });
}


export async function DELETE(request: Request, context: { params: Promise<{ caseId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId } = await context.params;

  try {
    await updateStore(async (store) => {
      const item = store.cases.find((entry) => entry.id === caseId && !entry.deletedAt);
      if (!item) {
        throw new Error('NOT_FOUND');
      }
      if (!ensureCanManageCase(item, user)) {
        throw new Error('FORBIDDEN');
      }

      item.deletedAt = new Date().toISOString();
      item.status = 'CLOSED';
      item.updatedAt = new Date().toISOString();
      item.statusHistory.unshift({
        id: createId('history'),
        status: 'CLOSED',
        changedByUserId: user.id,
        note: 'Report deleted by the owner',
        createdAt: new Date().toISOString()
      });

      store.matches = store.matches.filter((match) => match.caseId !== caseId && match.otherCaseId !== caseId);
      store.notifications = store.notifications.filter((notification) => notification.relatedCaseId !== caseId);
      createNotification(store, user.id, 'Report deleted', `${item.referenceCode} was removed from your account.`, 'case');
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'You do not have access to delete this case.' }, { status: 403 });
    }
    throw error;
  }

  return NextResponse.json({ success: true, caseId });
}
