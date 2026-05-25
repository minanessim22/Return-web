import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { getClientIp, getUserAgent, hashValue } from '@/lib/server/security';
import { readStore, sanitizeUser, updateStore } from '@/lib/server/store';

export const SESSION_COOKIE_NAME = 'return_session';

async function getTokenFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

function sessionDurationMs(rememberMe = true) {
  return rememberMe ? 1000 * 60 * 60 * 24 * 180 : 1000 * 60 * 60 * 24 * 45;
}

function shouldRefreshLastSeen(lastSeenAt?: string) {
  if (!lastSeenAt) return true;
  const previous = new Date(lastSeenAt).getTime();
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
  const expiresAt = new Date(now + sessionDurationMs(rememberMe)).toISOString();
  const ip = getClientIp(options.request);
  const userAgent = getUserAgent(options.request);

  await updateStore((store) => {
    const currentIso = new Date().toISOString();
    const activeSessions = store.sessions.filter((item) => item.expiresAt > currentIso);
    const otherUsers = activeSessions.filter((item) => item.userId !== userId);
    const currentUserSessions = activeSessions
      .filter((item) => item.userId === userId)
      .sort((left, right) => (left.lastSeenAt < right.lastSeenAt ? 1 : -1))
      .slice(0, 4);

    store.sessions = [
      {
        id: `session_${randomBytes(8).toString('hex')}`,
        userId,
        tokenHash: hashValue(token),
        csrfToken: options.csrfToken,
        rememberMe,
        userAgent,
        ipHash: ip ? hashValue(ip) : undefined,
        expiresAt,
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      ...currentUserSessions,
      ...otherUsers
    ];
  });

  return { token, expiresAt };
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
    expires: new Date(0)
  });
}

export async function touchCurrentSession() {
  const token = await getTokenFromCookie();
  if (!token) return null;

  const tokenHash = hashValue(token);
  const store = await readStore();
  const session = store.sessions.find((item) => item.tokenHash === tokenHash);
  
  if (!session) return null;

  if (shouldRefreshLastSeen(session.lastSeenAt)) {
    const newExpiresAt = new Date(Date.now() + sessionDurationMs(session.rememberMe)).toISOString();
    await updateStore((draft) => {
      const draftSession = draft.sessions.find((item) => item.tokenHash === tokenHash);
      if (draftSession) {
        draftSession.lastSeenAt = new Date().toISOString();
        draftSession.expiresAt = newExpiresAt;
      }
    });
    return { token, expiresAt: newExpiresAt };
  }

  return { token, expiresAt: session.expiresAt };
}

export async function destroyCurrentSession() {
  const token = await getTokenFromCookie();
  if (!token) {
    return;
  }
  const tokenHash = hashValue(token);
  await updateStore((store) => {
    store.sessions = store.sessions.filter((item) => item.tokenHash !== tokenHash);
  });
}

export async function getCurrentStoredUser() {
  const token = await getTokenFromCookie();
  if (!token) {
    return null;
  }

  const tokenHash = hashValue(token);
  const store = await readStore();
  const session = store.sessions.find((item) => item.tokenHash === tokenHash);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= new Date().toISOString()) {
    await updateStore((draft) => {
      draft.sessions = draft.sessions.filter((item) => item.tokenHash !== tokenHash);
    });
    return null;
  }

  if (shouldRefreshLastSeen(session.lastSeenAt)) {
    await updateStore((draft) => {
      const current = draft.sessions.find((item) => item.tokenHash === tokenHash);
      if (current) current.lastSeenAt = new Date().toISOString();
    });
  }

  const user = store.users.find((item) => item.id === session.userId) || null;
  if (!user || user.status === 'DELETED') {
    return null;
  }
  return user;
}

export async function getCurrentUser() {
  const user = await getCurrentStoredUser();
  return user ? sanitizeUser(user) : null;
}
