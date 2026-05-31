import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { buildPasswordResetEmail, sendMail } from '@/lib/server/email';
import { apiError, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { getClientIp, normalizeEmail } from '@/lib/server/security';
import { createVerificationRequest } from '@/lib/server/verification';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJsonBody(request);
  const email = normalizeEmail(String(body.email || ''));
  const ip = getClientIp(request) || 'unknown';

  const rate = await checkRateLimit(`password-code:${ip}:${email}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) {
    return apiError(429, 'Too many password reset attempts. Please wait before trying again.', {
      retryAfterMs: rate.retryAfterMs
    });
  }
  if (!email) return apiError(400, 'Please enter your email address.');

  // Find user directly in Supabase
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive'
      }
    }
  });

  if (!user) {
    // Return fake success for email enumeration mitigation
    return NextResponse.json({
      success: true,
      delivery: 'email',
      email,
      expiresInMinutes: 10,
      message: 'If that email exists, a password reset code has been sent.'
    });
  }

  // Create verification request in DB
  const { code } = await createVerificationRequest({
    purpose: 'RESET_PASSWORD',
    email,
    userId: user.id,
    payload: { userId: user.id },
    expiresInMinutes: 10
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
