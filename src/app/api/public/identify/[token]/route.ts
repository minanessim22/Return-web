import { NextResponse } from 'next/server';
import { getProfileByToken, readStore } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const store = await readStore();
  const item = getProfileByToken(store, token);
  if (!item) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }
  return NextResponse.json({ item });
}
