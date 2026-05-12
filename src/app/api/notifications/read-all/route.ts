import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin } from '@/lib/server/security';
import { updateStore } from '@/lib/server/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let count = 0;
  await updateStore((store) => {
    for (const item of store.notifications) {
      if (item.userId === user.id && !item.isRead) {
        item.isRead = true;
        item.readAt = new Date().toISOString();
        count += 1;
      }
    }
  });

  return NextResponse.json({ success: true, count });
}
