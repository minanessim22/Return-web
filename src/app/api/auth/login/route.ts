import { prisma } from '@/lib/server/db';
import { applySessionCookie, createSession } from '@/lib/server/session';
import { getClientIp, getUserAgent } from '@/lib/server/security';
import { apiError, apiJson, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { verifyPassword, sanitizeUser } from '@/lib/server/store';

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

  const userAgent = getUserAgent(request);

  const rate = checkRateLimit(
    `login:${ip}:${identifier.toLowerCase()}`,
    10,
    15 * 60 * 1000
  );

  if (!rate.allowed) {
    return apiError(
      429,
      'Too many login attempts.'
    );
  }

  if (!identifier || !password) {
    return apiError(
      400,
      'Email or username and password are required.'
    );
  }

  // ✅ البحث في Supabase مباشرة
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          email: {
            equals: identifier,
            mode: 'insensitive'
          }
        },
        {
          username: {
            equals: identifier,
            mode: 'insensitive'
          }
        }
      ]
    }
  });

  if (!user) {
    return apiError(401, 'Invalid credentials.');
  }

  if (
    user.lockedUntil &&
    new Date(user.lockedUntil) > new Date()
  ) {
    return apiError(
      423,
      'This account is temporarily locked.'
    );
  }

  // ✅ نتحقق من SUSPENDED ومقارنة DELETED بتجنب أخطاء النوع
  if (
    user.status === 'SUSPENDED' ||
    (user.status as any) === 'DELETED'
  ) {
    return apiError(
      403,
      'This account is not available.'
    );
  }

  // ✅ التحقق من الباسورد من الداتا بيز
  const validPassword = verifyPassword(
    password,
    user.passwordHash
  );

  if (!validPassword) {
    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        failedLoginCount: {
          increment: 1
        }
      }
    });

    return apiError(401, 'Invalid credentials.');
  }

  // ✅ تحديث بيانات تسجيل الدخول
  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
      status: 'ACTIVE'
    }
  });

  // ✅ إنشاء Session
  const { token, expiresAt } =
    await createSession(user.id, {
      rememberMe,
      request
    });

  const response = apiJson({
    user: sanitizeUser(user as any),
    accessToken: token,
    expiresAt
  });

  applySessionCookie(
    response,
    token,
    expiresAt
  );

  return response;
}
