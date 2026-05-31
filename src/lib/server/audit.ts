import { prisma } from './db';
import { logError } from './logger';

export interface AuditEventInput {
  userId?: string | null;
  eventType: string;
  severity?: 'info' | 'warn' | 'critical';
  target?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

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

/**
 * Log a structured audit event.
 * Saves to the database in a fire-and-forget manner to not block request resolution.
 */
export function logAuditEvent(event: AuditEventInput): void {
  const scrubbedMetadata = event.metadata ? scrubSecrets(event.metadata) : null;

  // Run database insert asynchronously without awaiting it
  // Cast prisma to any to bypass temporary local IDE schema synchronization lag
  (prisma as any).auditLog.create({
    data: {
      userId: event.userId || null,
      eventType: event.eventType,
      severity: event.severity || 'info',
      target: event.target || null,
      metadata: scrubbedMetadata as any,
      ip: event.ip || null,
      userAgent: event.userAgent || null,
    }
  }).catch((err: any) => {
    // If DB write fails, log to the application console/logger
    logError('Failed to write audit event to database', {
      error: err instanceof Error ? err.message : String(err),
      originalEvent: {
        userId: event.userId,
        eventType: event.eventType,
        severity: event.severity,
        target: event.target,
        ip: event.ip,
      }
    });
  });
}
