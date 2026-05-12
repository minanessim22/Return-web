import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { buildDashboardSummary, readStore } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const store = await readStore();
  return NextResponse.json(buildDashboardSummary(store, user.id));
}
