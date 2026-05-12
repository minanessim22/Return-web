import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { buildPasswordResetEmail, sendMail } from '@/lib/server/email';
import { apiError, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { getClientIp, getUserAgent, hashValue, normalizeEmail } from '@/lib/server/security';
import { createVerificationRequest, readStore, recordAuditLog, updateStore } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJsonBody(request);
  const email = normalizeEmail(String(body.email || ''));
  const ip = getClientIp(request) || 'unknown';
  const userAgent = getUserAgent(request);

  const rate = checkRateLimit(`password-code:${ip}:${email}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) {
    return apiError(429, 'Too many password reset attempts. Please wait before trying again.', {
      retryAfterMs: rate.retryAfterMs
    });
  }
  if (!email) return apiError(400, 'Please enter your email address.');

  const store = await readStore();
  const user = store.users.find((entry) => entry.email === email && entry.status !== 'DELETED');
  if (!user) {
    return NextResponse.json({
      success: true,
      delivery: 'email',
      email,
      expiresInMinutes: 10,
      message: 'If that email exists, a password reset code has been sent.'
    });
  }

  let code = '';
  await updateStore((draft) => {
    const created = createVerificationRequest(draft, {
      purpose: 'RESET_PASSWORD',
      email,
      userId: user.id,
      payload: { userId: user.id },
      expiresInMinutes: 10
    });
    code = created.code;
    recordAuditLog(draft, {
      event: 'auth_password_reset_requested',
      severity: 'info',
      userId: user.id,
      ipHash: hashValue(ip),
      userAgent,
      details: { email }
    });
  });

  const mail = buildPasswordResetEmail(code, user.name || user.username || 'there');
  const delivery = await sendMail({ to: email, ...mail });
  const providerWarning = delivery.delivery === 'outbox' ? (delivery as any).providerError || 'Email provider is not configured correctly.' : undefined;

  return NextResponse.json({
    success: true,
    delivery: delivery.delivery,
    email,
    expiresInMinutes: 10,
    message: delivery.delivery === 'email'
      ? 'A password reset code was sent to your email.'
      : 'A password reset code was generated but email delivery fell back to the local outbox.',
    providerWarning
  });
}
