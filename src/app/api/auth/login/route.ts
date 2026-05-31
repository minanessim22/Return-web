import { prisma } from '@/lib/server/db';
import { applySessionCookie, createSession } from '@/lib/server/session';
import { getClientIp, getUserAgent } from '@/lib/server/security';
import { apiError, apiJson, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { verifyPassword, sanitizeUser, passwordNeedsMigration, hashPassword } from '@/lib/server/auth-helpers';
import { logSecurityEvent } from '@/lib/server/logger';
import { logAuditEvent } from '@/lib/server/audit';

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
  const userAgent = getUserAgent(request) || 'unknown';

  const rate = await checkRateLimit(
    `login:${ip}:${identifier.toLowerCase()}`,
    10,
    15 * 60 * 1000
  );

  if (!rate.allowed) {
    logAuditEvent({
      eventType: 'RATE_LIMIT_HIT',
      severity: 'warn',
      metadata: { path: '/api/auth/login', identifier },
      ip,
      userAgent
    });
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

  // Timing attack mitigation: run verifyPassword on a dummy hash if user is not found
  const dummyHash = 'scrypt:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
  const targetHash = user ? user.passwordHash : dummyHash;
  const validPassword = verifyPassword(password, targetHash);

  if (!user) {
    logSecurityEvent({ type: 'LOGIN_NONEXISTENT', ip, identifier });
    logAuditEvent({
      eventType: 'LOGIN_FAILED_NONEXISTENT',
      severity: 'warn',
      metadata: { identifier },
      ip,
      userAgent
    });
    return apiError(401, 'Invalid credentials.');
  }

  // Check account lock
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    logSecurityEvent({ type: 'LOGIN_LOCKED', ip, identifier: user.email, userId: user.id });
    logAuditEvent({
      userId: user.id,
      eventType: 'LOGIN_LOCKED_ATTEMPT',
      severity: 'critical',
      target: `user:${user.id}`,
      metadata: { email: user.email },
      ip,
      userAgent
    });
    return apiError(423, 'This account is temporarily locked.');
  }

  // Check suspended accounts
  if (user.status === 'SUSPENDED') {
    logSecurityEvent({ type: 'LOGIN_SUSPENDED', ip, identifier: user.email, userId: user.id });
    logAuditEvent({
      userId: user.id,
      eventType: 'LOGIN_SUSPENDED_ATTEMPT',
      severity: 'warn',
      target: `user:${user.id}`,
      ip,
      userAgent
    });
    return apiError(403, 'This account is not available.');
  }

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

    logSecurityEvent({ type: 'LOGIN_FAILED', ip, identifier: user.email, userId: user.id, meta: { failedCount: newFailedCount } });
    logAuditEvent({
      userId: user.id,
      eventType: newFailedCount >= MAX_FAILED_LOGINS ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
      severity: newFailedCount >= MAX_FAILED_LOGINS ? 'critical' : 'warn',
      target: `user:${user.id}`,
      metadata: { failedCount: newFailedCount, email: user.email },
      ip,
      userAgent
    });

    if (newFailedCount >= MAX_FAILED_LOGINS) {
      return apiError(423, 'This account is temporarily locked due to too many failed login attempts.');
    }

    return apiError(401, 'Invalid credentials.');
  }

  // Successful login — reset failed count and unlock
  const loginUpdate: {
    failedLoginCount: number;
    lockedUntil: Date | null;
    lastLoginAt: Date;
    passwordHash?: string;
  } = {
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

  logSecurityEvent({ type: 'LOGIN_SUCCESS', ip, identifier: user.email, userId: user.id });
  logAuditEvent({
    userId: user.id,
    eventType: 'LOGIN_SUCCESS',
    severity: 'info',
    target: `user:${user.id}`,
    ip,
    userAgent
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
