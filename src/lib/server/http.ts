import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin, getClientIp } from '@/lib/server/security';
import { checkRateLimit } from '@/lib/server/rate-limit';
import type { PublicUser } from '@/lib/shared-types';

export function apiJson(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export function apiError(status: number, error: string, extra?: Record<string, unknown>) {
  return apiJson({ error, ...(extra || {}) }, { status });
}

export async function readJsonBody<T extends Record<string, unknown> = Record<string, unknown>>(request: Request) {
  return (await request.json().catch(() => ({}))) as T;
}

export function requireSameOrigin(request: Request) {
  return ensureSameOrigin(request) ? null : apiError(403, 'Invalid request origin.');
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: apiError(401, 'Authentication required.') };
  }
  return { user, response: null as NextResponse | null };
}

export async function requireAdmin() {
  const result = await requireUser();
  if (!result.user) {
    return result;
  }
  if (result.user.role !== 'ADMIN') {
    return { user: null, response: apiError(403, 'Admin access required.') };
  }
  return { user: result.user, response: null as NextResponse | null };
}

export function clampInteger(value: string | null, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

export function enforceRateLimit(input: { request: Request; label: string; limit: number; windowMs: number; user?: Pick<PublicUser, 'id'> | null; extraKey?: string }) {
  const ip = getClientIp(input.request) || 'unknown';
  const subject = input.user?.id || ip;
  const suffix = input.extraKey ? `:${input.extraKey}` : '';
  const bucket = checkRateLimit(`${input.label}:${subject}${suffix}`, input.limit, input.windowMs);
  if (bucket.allowed) return null;
  return apiError(429, 'Too many requests. Please try again in a moment.', {
    retryAfterMs: bucket.retryAfterMs
  });
}
