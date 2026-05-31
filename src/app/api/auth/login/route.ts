import { prisma } from '@/lib/server/db';
import { applySessionCookie, createSession } from '@/lib/server/session';
import { getClientIp, hashValue } from '@/lib/server/security';
import { apiError, apiJson, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { verifyPassword, sanitizeUser, passwordNeedsMigration, hashPassword } from '@/lib/server/auth-helpers';

export const runtime = 'nodejs';

const MAX_FAILED_LOGINS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const body = await readJsonBody(request);

  const identifier = String(
    body.emailOrUsername ||
    body.email ||
    body.username ||
    ''
  ).trim();

  const password = String(body.password || '');
  const rememberMe = body.rememberMe !== false;
  const ip = getClientIp(request) || 'unknown';

  const rate = checkRateLimit(
    `login:${ip}:${identifier.toLowerCase()}`,
    10,
    15 * 60 * 1000
  );

  if (!rate.allowed) {
    return apiError(429, 'Too many login attempts.');
  }

  if (!identifier || !password) {
    return apiError(400, 'Email or username and password are required.');
  }

  // Look up user by email or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: 'insensitive' } },
        { username: { equals: identifier, mode: 'insensitive' } }
      ]
    }
  });

  if (!user) {
    return apiError(401, 'Invalid credentials.');
  }

  // Check account lock
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return apiError(423, 'This account is temporarily locked.');
  }

  // Check suspended accounts
  if (user.status === 'SUSPENDED') {
    return apiError(403, 'This account is not available.');
  }

  // Verify password
  const validPassword = verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    const newFailedCount = user.failedLoginCount + 1;
    const updateData: { failedLoginCount: number; lockedUntil?: Date } = {
      failedLoginCount: newFailedCount
    };

    // Lock the account when the threshold is reached
    if (newFailedCount >= MAX_FAILED_LOGINS) {
      updateData.lockedUntil = new Date(Date.now() + LOCK_WINDOW_MS);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    if (newFailedCount >= MAX_FAILED_LOGINS) {
      return apiError(423, 'This account is temporarily locked due to too many failed login attempts.');
    }

    return apiError(401, 'Invalid credentials.');
  }

  // Successful login — reset failed count and unlock
  const loginUpdate: Record<string, unknown> = {
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: new Date()
  };

  // Transparently migrate legacy sha256 hashes to scrypt
  if (passwordNeedsMigration(user.passwordHash)) {
    loginUpdate.passwordHash = hashPassword(password);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: loginUpdate
  });

  // Create session
  const { token, expiresAt } = await createSession(user.id, {
    rememberMe,
    request
  });

  const response = apiJson({
    user: sanitizeUser(user),
    accessToken: token,
    expiresAt
  });

  applySessionCookie(response, token, expiresAt);

  return response;
}
