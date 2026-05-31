import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin } from '@/lib/server/security';
import { prisma } from '@/lib/server/db';

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

  const item = await prisma.notification.findFirst({
    where: { id: notificationId, userId: user.id }
  });

  if (!item) {
    return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  }

  const updatedItem = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return NextResponse.json({ item: updatedItem });
}
