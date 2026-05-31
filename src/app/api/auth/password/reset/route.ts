import { checkRateLimit } from '@/lib/server/rate-limit';
import { apiError, apiJson, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { getClientIp, getPasswordStrengthMessage, isStrongPassword } from '@/lib/server/security';
import { hashPassword } from '@/lib/server/auth-helpers';
import { verifyOneTimeCode } from '@/lib/server/verification';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJsonBody(request);
  const email = String(body.email || '').trim();
  const code = String(body.code || '').trim();
  const password = String(body.password || '');
  const ip = getClientIp(request) || 'unknown';

  const rate = checkRateLimit(`password-reset:${ip}:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return apiError(429, 'Too many reset attempts. Please wait and try again.', { retryAfterMs: rate.retryAfterMs });
  }
  if (!email || !code || !password) return apiError(400, 'Email, code, and new password are required.');
  if (!isStrongPassword(password)) return apiError(400, getPasswordStrengthMessage(password));

  try {
    const verification = await verifyOneTimeCode({ purpose: 'RESET_PASSWORD', email, code });
    if (!verification.ok) {
      return apiError(400, verification.reason);
    }

    const userId = verification.entry.userId || (verification.entry.payload as any)?.userId;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          { email: { equals: email, mode: 'insensitive' } }
        ]
      }
    });

    if (!user) {
      return apiError(404, 'No account was found for this reset request.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(password),
        failedLoginCount: 0,
        lockedUntil: null,
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('[PasswordReset] Reset error:', error);
    return apiError(500, 'An unexpected error occurred during password reset.');
  }

  return apiJson({ success: true, message: 'Password updated successfully. You can now sign in with your new password.' });
}
