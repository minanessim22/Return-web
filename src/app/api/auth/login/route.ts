import { applySessionCookie, createSession } from '@/lib/server/session';
import { getClientIp, getUserAgent, hashValue } from '@/lib/server/security';
import { apiError, apiJson, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import {
  findUserByIdentifier,
  hashPassword,
  passwordNeedsMigration,
  readStore,
  recordAuditLog,
  sanitizeUser,
  updateStore,
  verifyPassword
} from '@/lib/server/store';

export const runtime = 'nodejs';

const MAX_FAILED_LOGINS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const body = await readJsonBody(request);
  const identifier = String(body.emailOrUsername || body.email || body.username || '').trim();
  const password = String(body.password || '');
  const rememberMe = body.rememberMe !== false;
  const ip = getClientIp(request) || 'unknown';
  const userAgent = getUserAgent(request);

  const rate = checkRateLimit(`login:${ip}:${identifier.toLowerCase()}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return apiError(429, 'Too many login attempts. Please wait a few minutes and try again.', {
      retryAfterMs: rate.retryAfterMs
    });
  }

  if (!identifier || !password) {
    return apiError(400, 'Email or username and password are required.');
  }

  const store = await readStore();
  const user = findUserByIdentifier(store, identifier);

  if (!user) {
    await updateStore((draft) => {
      recordAuditLog(draft, {
        event: 'auth_login_unknown_user',
        severity: 'warning',
        ipHash: hashValue(ip),
        userAgent,
        details: { identifier }
      });
    });
    return apiError(401, 'Invalid credentials.');
  }

  if (user.lockedUntil && user.lockedUntil > new Date().toISOString()) {
    return apiError(423, 'This account is temporarily locked due to too many failed login attempts.');
  }

  if (user.status === 'PENDING_VERIFICATION') {
    return apiError(403, 'Please verify your email first before signing in.');
  }

  if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
    return apiError(403, 'This account is not available.');
  }

  if (!verifyPassword(password, user.passwordHash)) {
    await updateStore((draft) => {
      const current = draft.users.find((item) => item.id === user.id);
      if (!current) return;
      current.failedLoginCount += 1;
      current.updatedAt = new Date().toISOString();
      if (current.failedLoginCount >= MAX_FAILED_LOGINS) {
        current.lockedUntil = new Date(Date.now() + LOCK_WINDOW_MS).toISOString();
        current.status = 'LOCKED';
      }
      recordAuditLog(draft, {
        event: 'auth_login_failed',
        severity: 'warning',
        userId: user.id,
        ipHash: hashValue(ip),
        userAgent,
        details: { identifier }
      });
    });
    return apiError(401, 'Invalid credentials.');
  }

  await updateStore((draft) => {
    const current = draft.users.find((item) => item.id === user.id);
    if (!current) return;
    current.failedLoginCount = 0;
    current.lockedUntil = undefined;
    if (current.status === 'LOCKED') current.status = 'ACTIVE';
    current.lastLoginAt = new Date().toISOString();
    current.updatedAt = new Date().toISOString();
    if (passwordNeedsMigration(current.passwordHash)) {
      current.passwordHash = hashPassword(password);
    }
    recordAuditLog(draft, {
      event: 'auth_login_success',
      severity: 'info',
      userId: user.id,
      ipHash: hashValue(ip),
      userAgent,
      details: { rememberMe }
    });
  });

  const refreshed = (await readStore()).users.find((item) => item.id === user.id);
  if (!refreshed) {
    return apiError(500, 'Unable to complete login.');
  }

  const { token, expiresAt } = await createSession(refreshed.id, { rememberMe, request });
  const response = apiJson({
    user: sanitizeUser(refreshed),
    accessToken: token,
    expiresAt
  });
  applySessionCookie(response, token, expiresAt);
  return response;
}
