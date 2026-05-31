/**
 * Enterprise structured logging module.
 *
 * Outputs compact JSON in production for ingestion by Axiom, Datadog,
 * Vercel Log Drains, or any structured log pipeline.
 * Outputs human-readable colored lines in development.
 *
 * Features:
 * - Log levels: info, warn, error, security
 * - Per-request logger with bound context (requestId, ip, route, userAgent)
 * - Automatic secret scrubbing — keys matching sensitive patterns are redacted
 * - Email/identifier redaction for PII safety
 */

// ── Secret Scrubbing ─────────────────────────────────────────────

const SENSITIVE_KEYS = /password|token|secret|hash|key|authorization|cookie|credential|dsn/i;

function scrubSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(key)) {
      cleaned[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = scrubSecrets(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ── Identifier Redaction ─────────────────────────────────────────

function redactIdentifier(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    return `${local.slice(0, 3)}***@${domain}`;
  }
  if (value.length <= 3) return '***';
  return `${value.slice(0, 3)}***`;
}

// ── Log Levels ───────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'security';

interface LogEntry {
  level: LogLevel;
  message: string;
  category?: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  route?: string;
  userAgent?: string;
  timestamp: string;
  [key: string]: unknown;
}

const isProd = () => process.env.NODE_ENV === 'production';

function emit(entry: LogEntry): void {
  const scrubbed = scrubSecrets(entry as unknown as Record<string, unknown>);

  if (isProd()) {
    const line = JSON.stringify(scrubbed);
    if (entry.level === 'error') {
      console.error(line);
    } else if (entry.level === 'warn' || entry.level === 'security') {
      console.warn(line);
    } else {
      console.info(line);
    }
  } else {
    const prefix = `[${entry.level.toUpperCase()}]`;
    const ctx = [
      entry.category && `cat=${entry.category}`,
      entry.requestId && `req=${entry.requestId}`,
      entry.ip && `ip=${entry.ip}`,
      entry.userId && `user=${entry.userId}`,
      entry.route && `route=${entry.route}`,
    ].filter(Boolean).join(' ');
    const extraKeys = Object.keys(entry).filter(
      (k) => !['level', 'message', 'timestamp', 'category', 'requestId', 'ip', 'userId', 'route', 'userAgent'].includes(k)
    );
    const extraStr = extraKeys.length > 0 ? ` | meta=${JSON.stringify(extraKeys.reduce((acc, k) => ({ ...acc, [k]: entry[k] }), {}))}` : '';
    const line = `${prefix} ${entry.message}${ctx ? ` | ${ctx}` : ''}${extraStr}`;
    if (entry.level === 'error') {
      console.error(line);
    } else if (entry.level === 'warn' || entry.level === 'security') {
      console.warn(line);
    } else {
      console.info(line);
    }
  }
}

// ── Core Logging Functions ───────────────────────────────────────

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  emit({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  });
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  log('info', message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  log('warn', message, meta);
}

export function logError(message: string, meta?: Record<string, unknown>): void {
  log('error', message, meta);
}

// ── Per-Request Logger ───────────────────────────────────────────

export interface RequestContext {
  requestId?: string;
  ip?: string;
  route?: string;
  userAgent?: string;
  userId?: string;
}

export interface RequestLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  security(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Create a logger bound to a specific request context.
 * All log entries will automatically include requestId, ip, route, etc.
 */
export function createRequestLogger(ctx: RequestContext): RequestLogger {
  const base = {
    requestId: ctx.requestId,
    ip: ctx.ip,
    route: ctx.route,
    userAgent: ctx.userAgent,
    userId: ctx.userId,
  };

  return {
    info: (message, meta) => log('info', message, { ...base, ...meta }),
    warn: (message, meta) => log('warn', message, { ...base, ...meta }),
    error: (message, meta) => log('error', message, { ...base, ...meta }),
    security: (message, meta) => log('security', message, { category: 'security', ...base, ...meta }),
  };
}

/**
 * Create a RequestLogger from a raw Request object.
 */
export function createRequestLoggerFromRequest(request: Request): RequestLogger {
  const url = new URL(request.url);
  return createRequestLogger({
    requestId: request.headers.get('x-request-id') || undefined,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    route: url.pathname,
    userAgent: request.headers.get('user-agent') || undefined,
  });
}

// ── Security Event Logging (backward compatible) ─────────────────

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_LOCKED'
  | 'LOGIN_SUSPENDED'
  | 'LOGIN_NONEXISTENT'
  | 'ADMIN_AUTH_FAILED'
  | 'RATE_LIMIT_HIT'
  | 'SESSION_CREATED'
  | 'SESSION_DESTROYED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'ACCOUNT_REGISTERED'
  | 'ACCOUNT_DELETED';

export interface SecurityEvent {
  type: SecurityEventType;
  ip?: string;
  userId?: string;
  identifier?: string;
  path?: string;
  meta?: Record<string, unknown>;
}

const FAILURE_EVENTS: ReadonlySet<string> = new Set([
  'LOGIN_FAILED',
  'LOGIN_LOCKED',
  'LOGIN_SUSPENDED',
  'LOGIN_NONEXISTENT',
  'ADMIN_AUTH_FAILED',
  'RATE_LIMIT_HIT',
]);

/**
 * Log a structured security event.
 * Backward-compatible with the original API used by the login route.
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const level: LogLevel = FAILURE_EVENTS.has(event.type) ? 'security' : 'info';
  log(level, event.type, {
    category: 'security',
    type: event.type,
    ip: event.ip ?? 'unknown',
    userId: event.userId,
    identifier: redactIdentifier(event.identifier),
    path: event.path,
    ...event.meta,
  });
}
