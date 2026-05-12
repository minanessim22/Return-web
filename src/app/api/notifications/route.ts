import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { readStore } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const store = await readStore();
  const items = store.notifications
    .filter((item) => item.userId === user.id)
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));

  return NextResponse.json({ items });
}
