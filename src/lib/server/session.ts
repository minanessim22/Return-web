import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { getClientIp, getUserAgent, hashValue } from '@/lib/server/security';
import { sanitizeUser } from '@/lib/server/auth-helpers';
import { prisma } from '@/lib/server/db';

export const SESSION_COOKIE_NAME = 'return_session';

async function getTokenFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

function sessionDurationMs(rememberMe = true) {
  return rememberMe ? 1000 * 60 * 60 * 24 * 180 : 1000 * 60 * 60 * 24 * 45;
}

function shouldRefreshLastSeen(lastSeenAt?: Date) {
  if (!lastSeenAt) return true;
  const previous = lastSeenAt.getTime();
  if (Number.isNaN(previous)) return true;
  return Date.now() - previous >= 1000 * 60 * 5;
}

export async function createSession(
  userId: string,
  options: { rememberMe?: boolean; request?: Request; csrfToken?: string } = {}
) {
  const token = randomBytes(32).toString('base64url');
  const rememberMe = options.rememberMe !== false;
  const now = Date.now();
  const expiresAt = new Date(now + sessionDurationMs(rememberMe));
  const ip = getClientIp(options.request);
  const userAgent = getUserAgent(options.request);

  // Enforce session limit per user: keep latest 3 active sessions (slice(0, 4) limit checking)
  // const otherUsers = activeSessions.filter((item) => item.userId !== userId)
  try {
    const activeSessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' }
    });
    if (activeSessions.length >= 4) {
      const sessionsToDelete = activeSessions.slice(3);
      await prisma.session.deleteMany({
        where: { id: { in: sessionsToDelete.map((s) => s.id) } }
      });
    }

    await prisma.session.create({
      data: {
        userId,
        tokenHash: hashValue(token),
        csrfToken: options.csrfToken,
        rememberMe,
        userAgent,
        ipHash: ip ? hashValue(ip) : undefined,
        expiresAt,
        lastSeenAt: new Date()
      }
    });
  } catch (err) {
    console.error('[Session] Failed to create session in database:', err);
  }

  return { token, expiresAt: expiresAt.toISOString() };
}

export function applySessionCookie(response: NextResponse, token: string, expiresAt: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt)
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
    maxAge: 0
  });
}

export async function touchCurrentSession() {
  const token = await getTokenFromCookie();
  if (!token) return null;

  const tokenHash = hashValue(token);
  try {
    const session = await prisma.session.findFirst({
      where: { tokenHash }
    });

    if (!session) return null;

    if (shouldRefreshLastSeen(session.lastSeenAt)) {
      const newExpiresAt = new Date(Date.now() + sessionDurationMs(session.rememberMe));
      await prisma.session.update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date(),
          expiresAt: newExpiresAt
        }
      });
      return { token, expiresAt: newExpiresAt.toISOString() };
    }

    return { token, expiresAt: session.expiresAt.toISOString() };
  } catch (err) {
    console.error('[Session] Failed to touch session in database:', err);
    return null;
  }
}

export async function destroyCurrentSession() {
  const token = await getTokenFromCookie();
  if (!token) return;

  const tokenHash = hashValue(token);
  try {
    await prisma.session.deleteMany({
      where: { tokenHash }
    });
  } catch (err) {
    console.error('[Session] Failed to destroy session in database:', err);
  }
}

export async function getCurrentStoredUser() {
  const token = await getTokenFromCookie();
  if (!token) return null;

  const tokenHash = hashValue(token);
  try {
    // Background prune sessions expired more than 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prisma.session.deleteMany({
      where: { expiresAt: { lt: oneDayAgo } }
    }).catch((err) => {
      console.error('[Session] Failed to prune expired sessions:', err);
    });

    const session = await prisma.session.findFirst({
      where: { tokenHash },
      include: { user: true }
    });

    if (!session) return null;

    if (session.expiresAt <= new Date()) {
      await prisma.session.deleteMany({
        where: { tokenHash }
      });
      return null;
    }

    if (shouldRefreshLastSeen(session.lastSeenAt)) {
      await prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() }
      });
    }

    const user = session.user;
    if (!user || user.status === 'SUSPENDED') {
      return null;
    }
    return user;
  } catch (err) {
    console.error('[Session] Failed to retrieve current user from database:', err);
    return null;
  }
}

export async function getCurrentUser() {
  const user = await getCurrentStoredUser();
  return user ? sanitizeUser(user) : null;
}
