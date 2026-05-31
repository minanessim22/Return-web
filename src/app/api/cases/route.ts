import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { hydrateCase } from '@/lib/server/case-helpers';
import { prisma } from '@/lib/server/db';
import { getCachedPublicCases } from '@/lib/server/cache';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const ownerFilter = url.searchParams.get('owner') || undefined;
  const category = url.searchParams.get('category') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;
  const sort = url.searchParams.get('sort') || 'latest';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 12)));

  let ownerUserId: string | undefined;
  if (ownerFilter === 'me') {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required for owner=me.' }, { status: 401 });
    }
    ownerUserId = user.id;
  }

  try {
    const where: any = {
      deletedAt: null
    };

    if (ownerUserId) {
      where.ownerUserId = ownerUserId;
    }
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

    if (search) {
      const searchVal = search.trim().toLowerCase();
      where.OR = [
        { fullName: { contains: searchVal, mode: 'insensitive' } },
        { estimatedName: { contains: searchVal, mode: 'insensitive' } },
        { description: { contains: searchVal, mode: 'insensitive' } },
        { locationText: { contains: searchVal, mode: 'insensitive' } },
        { referenceCode: { contains: searchVal, mode: 'insensitive' } }
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sort === 'recent_update') {
      orderBy = { updatedAt: 'desc' };
    }

    let total: number;
    let cases: any[];

    if (ownerFilter === 'me') {
      // User-private data: bypass cache completely to avoid data leakage
      total = await prisma.caseItem.count({ where });
      cases = await prisma.caseItem.findMany({
        where,
        include: {
          images: true,
          owner: true
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      });
    } else {
      // Public data: use cache
      const cached = await getCachedPublicCases({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      });
      total = cached.total;
      cases = cached.cases;
    }

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
    console.error('[CasesGet] Error querying cases:', err);
    return NextResponse.json({ error: 'Failed to retrieve cases.' }, { status: 500 });
  }
}
