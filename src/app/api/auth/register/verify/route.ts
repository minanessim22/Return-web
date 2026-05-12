import { applySessionCookie, createSession } from '@/lib/server/session';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { apiError, apiJson, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { getClientIp, getUserAgent, hashValue } from '@/lib/server/security';
import {
  buildMyStats,
  createUserAccount,
  hashPassword,
  readStore,
  recordAuditLog,
  sanitizeUser,
  updateStore,
  verifyOneTimeCode
} from '@/lib/server/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJsonBody(request);
  const email = String(body.email || '').trim();
  const code = String(body.code || '').trim();
  const rememberMe = body.rememberMe !== false;
  const ip = getClientIp(request) || 'unknown';
  const userAgent = getUserAgent(request);

  const rate = checkRateLimit(`register-verify:${ip}:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return apiError(429, 'Too many verification attempts. Please wait and try again.', { retryAfterMs: rate.retryAfterMs });
  }

  if (!email || !code) return apiError(400, 'Email and verification code are required.');

  let createdUserId = '';
  try {
    await updateStore((draft) => {
      const verification = verifyOneTimeCode(draft, { purpose: 'REGISTER', email, code });
      if (!verification.ok) throw new Error(verification.reason);

      const payload = verification.entry.payload || {};
      const createdUser = createUserAccount(draft, {
        name: String(payload.name || '').trim(),
        username: typeof payload.username === 'string' ? payload.username : undefined,
        email: typeof payload.email === 'string' ? payload.email : email,
        phone: typeof payload.phone === 'string' ? payload.phone : undefined,
        dateOfBirth: typeof payload.dateOfBirth === 'string' ? payload.dateOfBirth : undefined,
        avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl : undefined,
        passwordHash: hashPassword(String(payload.password || '')),
        status: 'ACTIVE'
      });
      createdUserId = createdUser.id;
      recordAuditLog(draft, {
        event: 'auth_register_verified',
        severity: 'info',
        userId: createdUser.id,
        ipHash: hashValue(ip),
        userAgent,
        details: { email: createdUser.email }
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      const codeOrMessage = error.message;
      if (['No active verification request was found.', 'This code has expired. Please request a new one.', 'Too many invalid attempts. Please request a new code.', 'The verification code is incorrect.'].includes(codeOrMessage)) {
        return apiError(400, codeOrMessage);
      }
      if (codeOrMessage === 'EMAIL_TAKEN') return apiError(409, 'An account with this email already exists.');
      if (codeOrMessage === 'USERNAME_TAKEN') return apiError(409, 'This username is already taken.');
      if (codeOrMessage === 'INVALID_EMAIL') return apiError(400, 'Please enter a valid email address.');
      if (codeOrMessage === 'INVALID_USERNAME') return apiError(400, 'Please choose a valid username.');
    }
    throw error;
  }

  const store = await readStore();
  const createdUser = store.users.find((user) => user.id === createdUserId);
  if (!createdUser) return apiError(500, 'Unable to create the account.');

  const { token, expiresAt } = await createSession(createdUser.id, { rememberMe, request });
  const response = apiJson({
    user: sanitizeUser(createdUser),
    accessToken: token,
    expiresAt,
    stats: buildMyStats(store, createdUser.id),
    message: 'Email verified and account created successfully.'
  });
  applySessionCookie(response, token, expiresAt);
  return response;
}
