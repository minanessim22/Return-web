import { applySessionCookie, createSession } from '@/lib/server/session';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { apiError, apiJson, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { getClientIp } from '@/lib/server/security';
import { hashPassword, sanitizeUser } from '@/lib/server/auth-helpers';
import { verifyOneTimeCode } from '@/lib/server/verification';
import { buildMyStats } from '@/lib/server/dashboard-helpers';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJsonBody(request);
  const email = String(body.email || '').trim();
  const code = String(body.code || '').trim();
  const rememberMe = body.rememberMe !== false;
  const ip = getClientIp(request) || 'unknown';

  const rate = checkRateLimit(`register-verify:${ip}:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return apiError(429, 'Too many verification attempts. Please wait and try again.', { retryAfterMs: rate.retryAfterMs });
  }

  if (!email || !code) return apiError(400, 'Email and verification code are required.');

  try {
    const verification = await verifyOneTimeCode({ purpose: 'REGISTER', email, code });
    if (!verification.ok) {
      return apiError(400, verification.reason);
    }

    const payload = (verification.entry.payload as any) || {};
    const passwordHash = hashPassword(String(payload.password || ''));

    const createdUser = await prisma.$transaction(async (tx) => {
      const existingEmail = await tx.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
      });
      if (existingEmail) throw new Error('EMAIL_TAKEN');

      if (payload.username) {
        const existingUsername = await tx.user.findFirst({
          where: { username: { equals: payload.username, mode: 'insensitive' } }
        });
        if (existingUsername) throw new Error('USERNAME_TAKEN');
      }

      return tx.user.create({
        data: {
          name: String(payload.name || '').trim(),
          username: payload.username || undefined,
          email: email.trim().toLowerCase(),
          phone: payload.phone || undefined,
          dateOfBirth: payload.dateOfBirth || undefined,
          avatarUrl: payload.avatarUrl || undefined,
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          preference: {
            create: {
              language: 'en',
              darkMode: false,
              notificationsEnabled: true
            }
          }
        }
      });
    });

    const { token, expiresAt } = await createSession(createdUser.id, { rememberMe, request });
    const stats = await buildMyStats(createdUser.id);

    const response = apiJson({
      user: sanitizeUser(createdUser),
      accessToken: token,
      expiresAt,
      stats,
      message: 'Email verified and account created successfully.'
    });

    applySessionCookie(response, token, expiresAt);
    return response;
  } catch (error: any) {
    if (error instanceof Error) {
      const codeOrMessage = error.message;
      if (codeOrMessage === 'EMAIL_TAKEN') return apiError(409, 'An account with this email already exists.');
      if (codeOrMessage === 'USERNAME_TAKEN') return apiError(409, 'This username is already taken.');
    }
    console.error('[RegisterVerify] Error:', error);
    return apiError(500, 'Unable to create the account.');
  }
}
