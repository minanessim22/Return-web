import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.DEBUG_PRISMA === 'true' || process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Executes a database operation with retries on transient connection/pool errors.
 * Useful for handling temporary connection drops or pools exhaustion in serverless.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Identify transient database connection errors
      const isTransient = err && (
        (err.message && err.message.includes("Can't reach database server")) ||
        (err.code && ['P1001', 'P1002', 'P1003', 'P1008', 'P1017'].includes(err.code))
      );
      if (!isTransient) {
        throw err;
      }
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  throw lastError;
}
