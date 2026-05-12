import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import {
  createIdentificationProfileRecord,
  createOrUpdateDevice,
  parseOptionalNumber,
  parseOptionalString,
  readStore,
  updateStore
} from '@/lib/server/store';
import { ensureSameOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const store = await readStore();
  const items = store.identificationProfiles.filter((item) => item.ownerUserId === user.id);
  return NextResponse.json({ items });
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
  const displayName = parseOptionalString(body.displayName ?? body.name);
  if (!displayName) {
    return NextResponse.json({ error: 'Display name is required.' }, { status: 400 });
  }

  let profileId = '';
  await updateStore((store) => {
    const profile = createIdentificationProfileRecord(store, {
      ownerUserId: user.id,
      displayName,
      age: parseOptionalNumber(body.age),
      category: parseOptionalString(body.category ?? body.type),
      clothesColor: parseOptionalString(body.clothesColor),
      bloodType: parseOptionalString(body.bloodType),
      medicalNotes: parseOptionalString(body.medicalNotes),
      notes: parseOptionalString(body.notes),
      lastLocationText: parseOptionalString(body.lastLocationText ?? body.location),
      latitude: parseOptionalNumber(body.latitude),
      longitude: parseOptionalNumber(body.longitude),
      photoUrl: parseOptionalString(body.photoUrl ?? body.photo),
      emergencyContacts: Array.isArray(body.emergencyContacts)
        ? body.emergencyContacts
            .filter((item: unknown) => typeof item === 'object' && item !== null)
            .map((contact: any, index: number) => ({
              id: `contact_${Date.now()}_${index}`,
              contactName: String(contact.contactName || user.name),
              relation: typeof contact.relation === 'string' ? contact.relation : 'Owner',
              phone: String(contact.phone || user.phone || '')
            }))
        : [
            {
              id: `contact_${Date.now()}_0`,
              contactName: user.name,
              relation: 'Owner',
              phone: String(parseOptionalString(body.emergencyContact) || user.phone || '')
            }
          ]
    });
    profileId = profile.id;

    if (body.createQrDevice) {
      createOrUpdateDevice(store, {
        ownerUserId: user.id,
        type: 'QR',
        label: `${displayName} QR Tag`,
        linkedProfileId: profile.id,
        trackingEnabled: false
      });
    }
    if (body.createGpsDevice) {
      createOrUpdateDevice(store, {
        ownerUserId: user.id,
        type: 'GPS',
        label: `${displayName} GPS Bracelet`,
        linkedProfileId: profile.id,
        trackingEnabled: true,
        updateIntervalMinutes: 5,
        latitude: parseOptionalNumber(body.latitude),
        longitude: parseOptionalNumber(body.longitude),
        lastLocationText: parseOptionalString(body.lastLocationText ?? body.location)
      });
    }
  });

  const store = await readStore();
  const item = store.identificationProfiles.find((profile) => profile.id === profileId);
  return NextResponse.json({ item }, { status: 201 });
}
