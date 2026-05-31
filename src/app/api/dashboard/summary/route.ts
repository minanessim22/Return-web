import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { buildDashboardSummary } from '@/lib/server/dashboard-helpers';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const summary = await buildDashboardSummary(user.id);
  return NextResponse.json(summary);
}
