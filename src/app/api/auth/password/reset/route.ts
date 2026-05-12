import { checkRateLimit } from '@/lib/server/rate-limit';
import { apiError, apiJson, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { getClientIp, getPasswordStrengthMessage, getUserAgent, hashValue, isStrongPassword } from '@/lib/server/security';
import { hashPassword, recordAuditLog, updateStore, verifyOneTimeCode } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJsonBody(request);
  const email = String(body.email || '').trim();
  const code = String(body.code || '').trim();
  const password = String(body.password || '');
  const ip = getClientIp(request) || 'unknown';
  const userAgent = getUserAgent(request);

  const rate = checkRateLimit(`password-reset:${ip}:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return apiError(429, 'Too many reset attempts. Please wait and try again.', { retryAfterMs: rate.retryAfterMs });
  }
  if (!email || !code || !password) return apiError(400, 'Email, code, and new password are required.');
  if (!isStrongPassword(password)) return apiError(400, getPasswordStrengthMessage(password));

  try {
    await updateStore((draft) => {
      const verification = verifyOneTimeCode(draft, { purpose: 'RESET_PASSWORD', email, code });
      if (!verification.ok) throw new Error(verification.reason);

      const userId = verification.entry.userId || String(verification.entry.payload?.userId || '');
      const user = draft.users.find((entry) => entry.id === userId || entry.email === verification.entry.email);
      if (!user) throw new Error('ACCOUNT_NOT_FOUND');

      user.passwordHash = hashPassword(password);
      user.failedLoginCount = 0;
      user.lockedUntil = undefined;
      if (user.status === 'LOCKED') user.status = 'ACTIVE';
      user.updatedAt = new Date().toISOString();

      recordAuditLog(draft, {
        event: 'auth_password_reset_completed',
        severity: 'info',
        userId: user.id,
        ipHash: hashValue(ip),
        userAgent,
        details: { email: user.email }
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      if (['No active verification request was found.', 'This code has expired. Please request a new one.', 'Too many invalid attempts. Please request a new code.', 'The verification code is incorrect.'].includes(error.message)) {
        return apiError(400, error.message);
      }
      if (error.message === 'ACCOUNT_NOT_FOUND') {
        return apiError(404, 'No account was found for this reset request.');
      }
    }
    throw error;
  }

  return apiJson({ success: true, message: 'Password updated successfully. You can now sign in with your new password.' });
}
