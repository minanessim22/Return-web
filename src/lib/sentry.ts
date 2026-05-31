import { logError, logInfo } from './server/logger';

// ── Sentry Configuration & Parsing ─────────────────────────────────

const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV || 'development';

interface SentryClientConfig {
  publicKey: string;
  host: string;
  projectId: string;
  endpoint: string;
}

let sentryConfig: SentryClientConfig | null = null;

if (SENTRY_DSN) {
  try {
    const url = new URL(SENTRY_DSN);
    const publicKey = url.username;
    const host = url.host;
    const projectId = url.pathname.replace(/^\//, '');

    if (publicKey && host && projectId) {
      sentryConfig = {
        publicKey,
        host,
        projectId,
        endpoint: `https://${host}/api/${projectId}/store/`,
      };
    }
  } catch (err) {
    console.error('Failed to parse SENTRY_DSN:', err);
  }
}

// ── PII Scrubbing ──────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const POSTGRES_URL_REGEX = /postgresql:\/\/[^:]+:[^@]+@[^/]+\/[^?\s]+/g;
const PASSWORD_FIELDS_REGEX = /"password"\s*:\s*"[^"]*"/gi;

function scrubPii(text: string): string {
  let cleaned = text;
  // Scrub PostgreSQL URLs
  cleaned = cleaned.replace(POSTGRES_URL_REGEX, 'postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@[REDACTED_HOST]/[REDACTED_DB]');
  // Scrub Emails
  cleaned = cleaned.replace(EMAIL_REGEX, '***@email.redacted');
  // Scrub Password fields in JSON string representations
  cleaned = cleaned.replace(PASSWORD_FIELDS_REGEX, '"password":"[REDACTED]"');
  return cleaned;
}

function scrubContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const serialized = JSON.stringify(context);
  const scrubbed = scrubPii(serialized);
  return JSON.parse(scrubbed);
}

// ── Auth Noise Filter ──────────────────────────────────────────────

const IGNORED_NOISE_PATTERNS = [
  /401/i,
  /403/i,
  /429/i,
  /authentication required/i,
  /admin access required/i,
  /too many requests/i,
  /invalid request origin/i,
];

function isNoise(message: string): boolean {
  return IGNORED_NOISE_PATTERNS.some((pattern) => pattern.test(message));
}

// ── UUID generator for Event ID ─────────────────────────────────────

function generateEventId(): string {
  // Generates a 32-character hex string representing Sentry event_id
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

// ── Main API ───────────────────────────────────────────────────────

/**
 * Capture an exception and send it to Sentry (or log it locally if no DSN configured).
 */
export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  const errorObj = err instanceof Error ? err : new Error(String(err));
  const errorMessage = errorObj.message;

  // Filter noise
  if (isNoise(errorMessage)) {
    return;
  }

  const eventId = generateEventId();
  const scrubbedMessage = scrubPii(errorMessage);
  const scrubbedStack = errorObj.stack ? scrubPii(errorObj.stack) : '';
  const scrubbedContext = scrubContext(context);

  if (!sentryConfig) {
    // Fallback: log to our structured logger
    logError(`[Sentry Placeholder] Exception captured: ${scrubbedMessage}`, {
      eventId,
      stack: scrubbedStack,
      ...scrubbedContext,
    });
    return;
  }

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString().slice(0, 19),
    platform: 'javascript',
    level: 'error',
    logger: 'return-server',
    environment: NODE_ENV,
    message: {
      formatted: scrubbedMessage,
    },
    exception: {
      values: [
        {
          type: errorObj.name || 'Error',
          value: scrubbedMessage,
          stacktrace: {
            frames: scrubbedStack
              ? scrubbedStack.split('\n').map((line) => ({ instruction_addr: line.trim() }))
              : [],
          },
        },
      ],
    },
    extra: scrubbedContext,
  };

  try {
    const response = await fetch(
      `${sentryConfig.endpoint}?sentry_version=7&sentry_client=custom-nextjs-sentry&sentry_key=${sentryConfig.publicKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'custom-nextjs-sentry/1.0.0',
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }
    );

    if (!response.ok) {
      console.error(`Sentry ingestion failed: ${response.status} ${response.statusText}`);
    }
  } catch (sendErr) {
    console.error('Failed to send exception to Sentry:', sendErr);
  }
}

/**
 * Capture a text message and send it to Sentry (or log it locally if no DSN configured).
 */
export async function captureMessage(
  msg: string,
  level: 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, unknown>
): Promise<void> {
  // Filter noise
  if (isNoise(msg)) {
    return;
  }

  const eventId = generateEventId();
  const scrubbedMessage = scrubPii(msg);
  const scrubbedContext = scrubContext(context);

  if (!sentryConfig) {
    // Fallback: log to our structured logger
    logInfo(`[Sentry Placeholder] Message captured: ${scrubbedMessage} (${level})`, {
      eventId,
      ...scrubbedContext,
    });
    return;
  }

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString().slice(0, 19),
    platform: 'javascript',
    level: level === 'warning' ? 'warning' : level,
    logger: 'return-server',
    environment: NODE_ENV,
    message: {
      formatted: scrubbedMessage,
    },
    extra: scrubbedContext,
  };

  try {
    const response = await fetch(
      `${sentryConfig.endpoint}?sentry_version=7&sentry_client=custom-nextjs-sentry&sentry_key=${sentryConfig.publicKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'custom-nextjs-sentry/1.0.0',
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }
    );

    if (!response.ok) {
      console.error(`Sentry ingestion failed: ${response.status} ${response.statusText}`);
    }
  } catch (sendErr) {
    console.error('Failed to send message to Sentry:', sendErr);
  }
}
