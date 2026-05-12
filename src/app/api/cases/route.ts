import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { queryCases, readStore } from '@/lib/server/store';
import type { CaseStatus, CaseType } from '@/lib/shared-types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = (url.searchParams.get('type') || undefined) as CaseType | undefined;
  const status = (url.searchParams.get('status') || undefined) as CaseStatus | undefined;
  const search = url.searchParams.get('search') || undefined;
  const ownerFilter = url.searchParams.get('owner') || undefined;
  const category = url.searchParams.get('category') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;
  const sort = (url.searchParams.get('sort') || undefined) as 'latest' | 'oldest' | 'best_match' | 'recent_update' | undefined;
  const page = Number(url.searchParams.get('page') || 1);
  const limit = Number(url.searchParams.get('limit') || 12);
  const store = await readStore();

  let ownerUserId: string | undefined;
  if (ownerFilter === 'me') {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required for owner=me.' }, { status: 401 });
    }
    ownerUserId = user.id;
  }

  return NextResponse.json(
    queryCases(store, {
      type,
      status,
      search,
      category,
      dateFrom,
      dateTo,
      sort,
      ownerUserId,
      page,
      limit
    })
  );
}
