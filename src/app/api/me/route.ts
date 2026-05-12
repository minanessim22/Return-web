import { NextResponse } from 'next/server';
import { buildMyStats, deleteUserAccount, readStore, sanitizeUser, updateStore, updateUserProfile } from '@/lib/server/store';
import { applySessionCookie, clearSessionCookie, getCurrentStoredUser, getCurrentUser, touchCurrentSession } from '@/lib/server/session';
import { ensureSameOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentStoredUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const store = await readStore();
  const stats = buildMyStats(store, user.id);
  const response = NextResponse.json({
    user: sanitizeUser(user),
    settings: user.preference,
    stats
  });

  const touchedSession = await touchCurrentSession();
  if (touchedSession) {
    applySessionCookie(response, touchedSession.token, touchedSession.expiresAt);
  }

  return response;
}

export async function PUT(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    await updateStore((store) => {
      updateUserProfile(store, user.id, {
        name: body.name,
        username: body.username,
        email: body.email,
        phone: body.phone,
        dateOfBirth: body.dateOfBirth,
        avatarUrl: body.avatarUrl,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        preference: typeof body.preference === 'object' && body.preference ? body.preference : undefined
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      const code = error.message;
      if (['NOT_FOUND', 'INVALID_EMAIL', 'EMAIL_TAKEN', 'INVALID_USERNAME', 'USERNAME_TAKEN', 'INVALID_PASSWORD'].includes(code) || code.includes('Password')) {
        return NextResponse.json({ error: code }, { status: code === 'NOT_FOUND' ? 404 : 400 });
      }
    }
    throw error;
  }

  const fresh = await getCurrentStoredUser();
  if (!fresh) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const store = await readStore();
  const response = NextResponse.json({
    user: sanitizeUser(fresh),
    settings: fresh.preference,
    stats: buildMyStats(store, fresh.id)
  });

  const touchedSession = await touchCurrentSession();
  if (touchedSession) {
    applySessionCookie(response, touchedSession.token, touchedSession.expiresAt);
  }

  return response;
}


export async function DELETE(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    await updateStore((store) => {
      deleteUserAccount(store, user.id, {
        currentPassword: typeof body.currentPassword === 'string' ? body.currentPassword : undefined
      });
    });
  } catch (error) {
    if (error instanceof Error && ['NOT_FOUND', 'INVALID_PASSWORD'].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'NOT_FOUND' ? 404 : 400 });
    }
    throw error;
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
