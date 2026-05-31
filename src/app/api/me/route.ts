import { NextResponse } from 'next/server';
import { applySessionCookie, clearSessionCookie, getCurrentStoredUser, touchCurrentSession } from '@/lib/server/session';
import { ensureSameOrigin, getPasswordStrengthMessage, isStrongPassword, isValidEmail, normalizeEmail, normalizePhone, normalizeUsername, sanitizePlainText } from '@/lib/server/security';
import { hashPassword, verifyPassword, sanitizeUser } from '@/lib/server/auth-helpers';
import { buildMyStats } from '@/lib/server/dashboard-helpers';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentStoredUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // Get user preference
  const preference = await prisma.userPreference.findUnique({
    where: { userId: user.id }
  });

  const stats = await buildMyStats(user.id);
  const response = NextResponse.json({
    user: sanitizeUser(user),
    settings: preference,
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

  const user = await getCurrentStoredUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const updateData: any = {};

    const nextEmail = body.email ? String(body.email).trim() : undefined;
    if (nextEmail && normalizeEmail(nextEmail) !== user.email) {
      if (!isValidEmail(nextEmail)) {
        return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
      }
      const normalized = normalizeEmail(nextEmail);
      const existingEmail = await prisma.user.findFirst({
        where: { email: normalized, id: { not: user.id } }
      });
      if (existingEmail) {
        return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 400 });
      }
      updateData.email = normalized;
    }

    const nextUsername = body.username ? String(body.username).trim() : undefined;
    if (nextUsername && normalizeUsername(nextUsername) !== user.username) {
      const normalized = normalizeUsername(nextUsername);
      if (!normalized) {
        return NextResponse.json({ error: 'INVALID_USERNAME' }, { status: 400 });
      }
      const existingUsername = await prisma.user.findFirst({
        where: { username: normalized, id: { not: user.id } }
      });
      if (existingUsername) {
        return NextResponse.json({ error: 'USERNAME_TAKEN' }, { status: 400 });
      }
      updateData.username = normalized;
    }

    const nextName = body.name ? sanitizePlainText(String(body.name).trim()) : undefined;
    if (nextName) {
      updateData.name = nextName;
    }

    if (body.phone !== undefined) {
      updateData.phone = normalizePhone(String(body.phone || ''));
    }

    if (body.dateOfBirth !== undefined) {
      updateData.dateOfBirth = body.dateOfBirth ? String(body.dateOfBirth).trim() : null;
    }

    if (body.avatarUrl !== undefined) {
      updateData.avatarUrl = body.avatarUrl ? String(body.avatarUrl).trim() : null;
    }

    if (body.newPassword) {
      if (!body.currentPassword || !verifyPassword(body.currentPassword, user.passwordHash)) {
        return NextResponse.json({ error: 'INVALID_PASSWORD' }, { status: 400 });
      }
      if (!isStrongPassword(body.newPassword)) {
        return NextResponse.json({ error: getPasswordStrengthMessage(body.newPassword) }, { status: 400 });
      }
      updateData.passwordHash = hashPassword(body.newPassword);
    }

    // Update User
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    // Update Preference
    let preference = null;
    if (body.preference && typeof body.preference === 'object') {
      const nextPreference = body.preference;
      const prefData: any = {};

      if (nextPreference.language !== undefined) {
        prefData.language = nextPreference.language === 'ar' ? 'ar' : 'en';
      }
      if (typeof nextPreference.darkMode === 'boolean') {
        prefData.darkMode = nextPreference.darkMode;
      }
      if (typeof nextPreference.notificationsEnabled === 'boolean') {
        prefData.notificationsEnabled = nextPreference.notificationsEnabled;
      }

      preference = await prisma.userPreference.upsert({
        where: { userId: user.id },
        update: prefData,
        create: {
          userId: user.id,
          language: prefData.language || 'en',
          darkMode: prefData.darkMode || false,
          notificationsEnabled: prefData.notificationsEnabled !== false
        }
      });
    } else {
      preference = await prisma.userPreference.findUnique({
        where: { userId: user.id }
      });
    }

    const stats = await buildMyStats(user.id);
    const response = NextResponse.json({
      user: sanitizeUser(updatedUser),
      settings: preference,
      stats
    });

    const touchedSession = await touchCurrentSession();
    if (touchedSession) {
      applySessionCookie(response, touchedSession.token, touchedSession.expiresAt);
    }

    return response;
  } catch (error) {
    console.error('[MeUpdate] Error updating user:', error);
    return NextResponse.json({ error: 'FAILED_TO_UPDATE' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentStoredUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if (!body.currentPassword || !verifyPassword(body.currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'INVALID_PASSWORD' }, { status: 400 });
  }

  try {
    // Delete user from PostgreSQL (this will cascade delete sessions, preferences, etc.)
    await prisma.user.delete({
      where: { id: user.id }
    });

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('[MeDelete] Error deleting user:', error);
    return NextResponse.json({ error: 'FAILED_TO_DELETE' }, { status: 500 });
  }
}
