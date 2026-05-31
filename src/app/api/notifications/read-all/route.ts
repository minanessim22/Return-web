import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin } from '@/lib/server/security';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const result = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      isRead: false
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return NextResponse.json({ success: true, count: result.count });
}
