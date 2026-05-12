import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { buildVerificationEmail, sendMail } from '@/lib/server/email';
import { apiError, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import {
  getClientIp,
  getPasswordStrengthMessage,
  getUserAgent,
  hashValue,
  isStrongPassword,
  isValidEmail,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
  sanitizePlainText
} from '@/lib/server/security';
import { createVerificationRequest, readStore, recordAuditLog, updateStore } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJsonBody(request);
  const name = sanitizePlainText(String(body.name || '').trim());
  const requestedUsername = normalizeUsername(String(body.username || ''));
  const email = normalizeEmail(String(body.email || ''));
  const phone = normalizePhone(String(body.phone || ''));
  const dateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth.trim() || undefined : undefined;
  const password = String(body.password || '');
  const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() || undefined : undefined;
  const ip = getClientIp(request) || 'unknown';
  const userAgent = getUserAgent(request);

  const rate = checkRateLimit(`register-code:${ip}:${email}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) {
    return apiError(429, 'Too many verification attempts. Please wait before trying again.', {
      retryAfterMs: rate.retryAfterMs
    });
  }

  if (name.length < 2) return apiError(400, 'Please enter a valid full name.');
  if (!isValidEmail(email)) return apiError(400, 'Please enter a valid email address.');
  if (!isStrongPassword(password)) return apiError(400, getPasswordStrengthMessage(password));

  const store = await readStore();
  if (store.users.some((entry) => entry.email === email && entry.status !== 'DELETED')) {
    return apiError(409, 'An account with this email already exists.');
  }
  if (requestedUsername && store.users.some((entry) => entry.username === requestedUsername && entry.status !== 'DELETED')) {
    return apiError(409, 'This username is already taken.');
  }

  let code = '';
  await updateStore((draft) => {
    const created = createVerificationRequest(draft, {
      purpose: 'REGISTER',
      email,
      payload: {
        name,
        username: requestedUsername,
        email,
        phone,
        dateOfBirth,
        avatarUrl,
        password
      },
      expiresInMinutes: 10
    });
    code = created.code;
    recordAuditLog(draft, {
      event: 'auth_register_code_requested',
      severity: 'info',
      ipHash: hashValue(ip),
      userAgent,
      details: { email }
    });
  });

  const mail = buildVerificationEmail(code, name);
  const delivery = await sendMail({ to: email, ...mail });
  const providerWarning = delivery.delivery === 'outbox' ? (delivery as any).providerError || 'Email provider is not configured correctly.' : undefined;

  return NextResponse.json({
    success: true,
    delivery: delivery.delivery,
    email,
    expiresInMinutes: 10,
    message: delivery.delivery === 'email'
      ? 'A verification code was sent to your email.'
      : 'A verification code was generated but email delivery fell back to the local outbox.',
    providerWarning
  });
}
