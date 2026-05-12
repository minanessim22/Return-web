import { NextResponse } from 'next/server';
import { createNotification, getProfileByToken, readStore, recordProfileScan, updateStore } from '@/lib/server/store';

export const runtime = 'nodejs';

function normalizeToken(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes('/')) {
    return trimmed.split('/').filter(Boolean).pop() || trimmed;
  }
  return trimmed;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.token || body.rawValue || '').trim();
  if (!raw) {
    return NextResponse.json({ error: 'QR token is required.' }, { status: 400 });
  }

  const token = normalizeToken(raw);
  const store = await readStore();
  const item = getProfileByToken(store, token);
  if (!item) {
    return NextResponse.json({ error: 'No profile matches this QR token.' }, { status: 404 });
  }

  await updateStore((draft) => {
    recordProfileScan(draft, {
      profileId: item.id,
      type: 'QR',
      rawValue: raw,
      finderName: typeof body.finderName === 'string' ? body.finderName : undefined,
      finderPhone: typeof body.finderPhone === 'string' ? body.finderPhone : undefined,
      latitude: typeof body.latitude === 'number' ? body.latitude : undefined,
      longitude: typeof body.longitude === 'number' ? body.longitude : undefined,
      locationText: typeof body.locationText === 'string' ? body.locationText : undefined
    });
    createNotification(
      draft,
      item.ownerUserId,
      'QR profile scanned',
      `${item.displayName}'s profile was scanned from the found dashboard.`,
      'qr_scan'
    );
  });

  return NextResponse.json({ item });
}
