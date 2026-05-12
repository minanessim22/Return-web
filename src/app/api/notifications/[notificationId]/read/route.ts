import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin } from '@/lib/server/security';
import { readStore, updateStore } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ notificationId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { notificationId } = await context.params;
  await updateStore((store) => {
    const item = store.notifications.find((entry) => entry.id === notificationId && entry.userId === user.id);
    if (item) {
      item.isRead = true;
      item.readAt = new Date().toISOString();
    }
  });

  const store = await readStore();
  const item = store.notifications.find((entry) => entry.id === notificationId && entry.userId === user.id);
  if (!item) {
    return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  }
  return NextResponse.json({ item });
}
