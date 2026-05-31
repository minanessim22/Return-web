import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { prisma } from '@/lib/server/db';
import { hydrateCase } from '@/lib/server/case-helpers';
import type { CaseStatus, CaseType } from '@/lib/shared-types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get('type') || undefined) as CaseType | undefined;
  const status = (url.searchParams.get('status') || undefined) as CaseStatus | undefined;
  const category = url.searchParams.get('category') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;
  const sort = (url.searchParams.get('sort') || undefined) as 'latest' | 'oldest' | 'best_match' | 'recent_update' | undefined;
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 12)));

  try {
    const where: any = {
      ownerUserId: user.id,
      deletedAt: null
    };

    if (type) {
      where.type = type as any;
    }
    if (status) {
      where.status = status as any;
    }
    if (category) {
      where.category = {
        contains: category,
        mode: 'insensitive'
      };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lte: dateTo ? new Date(dateTo) : undefined
      };
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sort === 'recent_update') {
      orderBy = { updatedAt: 'desc' };
    }

    const total = await prisma.caseItem.count({ where });
    const cases = await prisma.caseItem.findMany({
      where,
      include: {
        images: true,
        owner: true
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    });

    const items = await Promise.all(cases.map((c) => hydrateCase(c, true)));
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      items,
      page,
      limit,
      total,
      totalPages
    });
  } catch (err) {
    console.error('[MeReportsGet] Error querying cases:', err);
    return NextResponse.json({ error: 'Failed to retrieve user reports.' }, { status: 500 });
  }
}
