import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin, publicBaseUrl } from '@/lib/server/security';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ profileId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const { profileId } = await context.params;

  let profile = await prisma.identificationProfile.findFirst({
    where: { id: profileId, ownerUserId: user.id }
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  let token = profile.qrPublicToken;
  if (!token) {
    token = `qr_${randomBytes(6).toString('hex')}`;
    profile = await prisma.identificationProfile.update({
      where: { id: profileId },
      data: { qrPublicToken: token }
    });
  }

  const publicUrl = `${publicBaseUrl(request)}/identify/${token}`;
  return NextResponse.json({ token, publicUrl });
}
