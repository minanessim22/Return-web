import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

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
  const profile = await prisma.identificationProfile.findFirst({
    where: { qrPublicToken: token, isActive: true },
    include: {
      emergencyContacts: true
    }
  });

  if (!profile) {
    return NextResponse.json({ error: 'No profile matches this QR token.' }, { status: 404 });
  }

  // Create scan event
  await prisma.scanEvent.create({
    data: {
      profileId: profile.id,
      scanType: 'QR',
      scanToken: raw,
      latitude: typeof body.latitude === 'number' ? body.latitude : undefined,
      longitude: typeof body.longitude === 'number' ? body.longitude : undefined,
      metadata: {
        finderName: typeof body.finderName === 'string' ? body.finderName : undefined,
        finderPhone: typeof body.finderPhone === 'string' ? body.finderPhone : undefined,
        locationText: typeof body.locationText === 'string' ? body.locationText : undefined
      }
    }
  });

  if (profile.ownerUserId) {
    await prisma.notification.create({
      data: {
        userId: profile.ownerUserId,
        title: 'QR profile scanned',
        body: `${profile.displayName}'s profile was scanned from the found dashboard.`,
        type: 'qr_scan'
      }
    });
  }

  // Format to match expected public profile item structure
  const formatted = {
    id: profile.id,
    displayName: profile.displayName,
    age: profile.age,
    category: profile.category,
    clothesColor: profile.clothesColor,
    bloodType: profile.bloodType,
    medicalNotes: profile.medicalNotes,
    lastLocationText: profile.lastLocationText,
    latitude: profile.latitude,
    longitude: profile.longitude,
    photoUrl: profile.photoUrl,
    qrPublicToken: profile.qrPublicToken,
    isActive: profile.isActive,
    emergencyContacts: profile.emergencyContacts.map(c => ({
      contactName: c.contactName,
      relation: c.relation,
      phone: c.phone
    }))
  };

  return NextResponse.json({ item: formatted });
}
