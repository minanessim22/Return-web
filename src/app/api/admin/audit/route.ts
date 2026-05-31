import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { apiJson, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  const url = new URL(request.url);
  const eventType = url.searchParams.get('eventType') || undefined;
  const severity = url.searchParams.get('severity') || undefined;
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 25)));

  try {
    const where: any = {};
    if (eventType) {
      where.eventType = { contains: eventType, mode: 'insensitive' };
    }
    if (severity && severity !== 'ALL') {
      where.severity = severity;
    }

    const total = await prisma.auditLog.count({ where });
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiJson({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('[AdminAuditGet] Failed:', err);
    return NextResponse.json({ error: 'Failed to query audit logs' }, { status: 500 });
  }
}
