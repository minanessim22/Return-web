import { NextResponse } from 'next/server';
import { clearSessionCookie, destroyCurrentSession } from '@/lib/server/session';
import { ensureSameOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  await destroyCurrentSession();
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
