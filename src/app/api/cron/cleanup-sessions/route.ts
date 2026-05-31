import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Enforce Vercel Cron header authorization
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. Prune expired sessions
    const sessionsResult = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    // 2. Prune expired verification requests (OTP/temp codes)
    const verificationResult = await prisma.verificationRequest.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return NextResponse.json({
      success: true,
      deletedSessionsCount: sessionsResult.count,
      deletedVerificationRequestsCount: verificationResult.count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Cron DB Cleanup] Failed:', err);
    return NextResponse.json({ error: 'Failed to execute database cleanup' }, { status: 500 });
  }
}
