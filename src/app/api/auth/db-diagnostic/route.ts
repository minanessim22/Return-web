import { prisma } from '@/lib/server/db';
import { apiJson, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Require admin authentication
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      has_database_url: !!process.env.DATABASE_URL,
      has_direct_url: !!process.env.DIRECT_URL,
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      node_env: process.env.NODE_ENV || 'unknown',
    },
    prisma_connection: 'not_tested',
    error: null as string | null,
  };

function redactSensitiveInfo(msg: string): string {
  return msg.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/g, '$1***:***@');
}

  // Test Prisma Connection
  try {
    const userCount = await prisma.user.count();
    const sessionCount = await prisma.session.count();
    const caseCount = await prisma.caseItem.count();
    diagnostics.prisma_connection = 'success';
    diagnostics.counts = { users: userCount, sessions: sessionCount, cases: caseCount };
  } catch (err: unknown) {
    diagnostics.prisma_connection = 'failed';
    const rawError = err instanceof Error ? err.message : 'Unknown error';
    diagnostics.error = redactSensitiveInfo(rawError);
  }

  return apiJson(diagnostics, { status: diagnostics.error ? 500 : 200 });
}
