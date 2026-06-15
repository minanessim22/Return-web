import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const item = await prisma.identificationProfile.findFirst({
    where: { qrPublicToken: token, isActive: true },
    include: {
      emergencyContacts: true
    }
  });

  if (!item) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  // Format to match expected public profile item structure
  const formatted = {
    id: item.id,
    displayName: item.displayName,
    age: item.age,
    category: item.category,
    clothesColor: item.clothesColor,
    bloodType: item.bloodType,
    medicalNotes: item.medicalNotes,
    notes: item.notes,
    lastLocationText: item.lastLocationText,
    latitude: item.latitude,
    longitude: item.longitude,
    photoUrl: item.photoUrl,
    qrPublicToken: item.qrPublicToken,
    nfcTagUid: item.nfcTagUid,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    emergencyContacts: item.emergencyContacts.map(c => ({
      contactName: c.contactName,
      relation: c.relation,
      phone: c.phone
    }))
  };

  return NextResponse.json({ item: formatted });
}
