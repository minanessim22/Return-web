import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin, publicBaseUrl } from '@/lib/server/security';
import { readStore } from '@/lib/server/store';

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
  const store = await readStore();
  const profile = store.identificationProfiles.find((item) => item.id === profileId && item.ownerUserId === user.id);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }
  const publicUrl = `${publicBaseUrl(request)}/identify/${profile.qrPublicToken}`;
  return NextResponse.json({ token: profile.qrPublicToken, publicUrl });
}
