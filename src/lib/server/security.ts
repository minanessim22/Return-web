import { createHash, randomInt } from 'node:crypto';

export function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function getClientIp(request?: Request) {
  if (!request) return undefined;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim();
  }
  return request.headers.get('x-real-ip') || undefined;
}

export function getUserAgent(request?: Request) {
  return request?.headers.get('user-agent') || undefined;
}

export function ensureSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const targetOrigin = new URL(request.url).origin;

  if (origin) {
    return origin === targetOrigin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === targetOrigin;
    } catch {
      return false;
    }
  }

  return process.env.NODE_ENV !== 'production';
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function slugifyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/_{2,}/g, '_')
    .replace(/-{2,}/g, '-')
    .slice(0, 32);
}

export function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

export function isStrongPassword(password: string) {
  if (password.length < 8) return false;
  const checks = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  return checks >= 3;
}

export function getPasswordStrengthMessage(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password should include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password should include at least one lowercase letter.';
  if (!/\d/.test(password)) return 'Password should include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password should include at least one special character.';
  return 'Password is too weak.';
}

export function generateNumericCode(length = 6) {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += String(randomInt(0, 10));
  }
  return code;
}

export function dateToIso(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function sanitizePlainText(value: string) {
  return value.replace(/[<>]/g, '').trim();
}

export function publicBaseUrl(request?: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (request) {
    return new URL(request.url).origin;
  }
  return 'http://localhost:3000';
}
