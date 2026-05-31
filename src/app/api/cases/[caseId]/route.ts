import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { hydrateCase } from '@/lib/server/case-helpers';
import { upsertPotentialMatchesForCase } from '@/lib/server/match-helpers';
import { ensureSameOrigin, getClientIp, getUserAgent } from '@/lib/server/security';
import { prisma } from '@/lib/server/db';
import { logAuditEvent } from '@/lib/server/audit';

export const runtime = 'nodejs';

const validStatuses = ['DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'MATCHED', 'RESOLVED', 'CLOSED'];

function isValidCoordinate(latitude?: number, longitude?: number) {
  if (latitude === undefined && longitude === undefined) return true;
  if (latitude === undefined || longitude === undefined) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;

  try {
    const item = await prisma.caseItem.findUnique({
      where: { id: caseId },
      include: {
        images: true,
        owner: true
      }
    });

    if (!item || item.deletedAt) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    const hydrated = await hydrateCase(item, true);
    return NextResponse.json({ item: hydrated });
  } catch (err) {
    console.error('[CaseDetailsGet] Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve case details.' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ caseId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const item = await prisma.caseItem.findUnique({
      where: { id: caseId }
    });

    if (!item || item.deletedAt) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    const canManage = item.ownerUserId === user.id || user.role === 'ADMIN';
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have access to edit this case.' }, { status: 403 });
    }

    const age = body.age !== undefined ? Number(body.age) : undefined;
    const locationText = body.locationText || body.location;
    const description = body.description;
    const clothesColor = body.clothesColor;
    const eventTimeStr = body.eventTime || body.lastSeenAt || body.foundAt || body.dateTime;

    if (age === undefined || Number.isNaN(age)) {
      return NextResponse.json({ error: 'Age is required for every report.' }, { status: 400 });
    }
    if (age < 0 || age > 120) {
      return NextResponse.json({ error: 'Age must be between 0 and 120.' }, { status: 400 });
    }
    if (!locationText) {
      return NextResponse.json({ error: 'Address / location is required for every report.' }, { status: 400 });
    }
    if (!eventTimeStr) {
      return NextResponse.json({ error: 'Date / time is required for every report.' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Description is required for every report.' }, { status: 400 });
    }
    if (!clothesColor) {
      return NextResponse.json({ error: 'Clothes / visual notes are required for every report.' }, { status: 400 });
    }

    const latitude = body.latitude !== undefined ? Number(body.latitude) : undefined;
    const longitude = body.longitude !== undefined ? Number(body.longitude) : undefined;
    if (!isValidCoordinate(latitude, longitude)) {
      return NextResponse.json({ error: 'Please enter a valid map location.' }, { status: 400 });
    }

    const nextStatus = validStatuses.includes(body.status) ? body.status : undefined;
    const nextImages = Array.isArray(body.images) ? body.images : undefined;

    const updateData: any = {
      fullName: body.fullName || body.name || undefined,
      estimatedName: body.estimatedName || undefined,
      category: body.category || body.type || undefined,
      age,
      gender: body.gender || undefined,
      description,
      clothesColor,
      conditionNotes: body.conditionNotes || undefined,
      contactPhone: body.contactPhone || undefined,
      locationText,
      latitude,
      longitude,
      eventTime: new Date(eventTimeStr)
    };

    if (nextStatus && nextStatus !== item.status) {
      updateData.status = nextStatus as any;
      updateData.statusHistory = {
        create: {
          status: nextStatus,
          changedByUserId: user.id,
          note: 'Case updated from dashboard'
        }
      };
    }

    if (nextImages !== undefined) {
      // Clear old images and create new ones
      await prisma.caseImage.deleteMany({ where: { caseId } });
      updateData.images = {
        create: nextImages.map((imageUrl: string, index: number) => ({
          imageUrl,
          sortOrder: index
        }))
      };
    } else if (typeof body.photo === 'string' && body.photo.trim()) {
      await prisma.caseImage.deleteMany({ where: { caseId } });
      updateData.images = {
        create: [{
          imageUrl: body.photo.trim(),
          sortOrder: 0
        }]
      };
    }

    const updated = await prisma.caseItem.update({
      where: { id: caseId },
      data: updateData,
      include: {
        images: true,
        owner: true
      }
    });

    // Log the update event in database audit log
    logAuditEvent({
      userId: user.id,
      eventType: 'CASE_UPDATE',
      severity: 'info',
      target: `case:${caseId}`,
      metadata: {
        referenceCode: item.referenceCode,
        statusChange: nextStatus && nextStatus !== item.status ? { from: item.status, to: nextStatus } : undefined
      },
      ip: getClientIp(request),
      userAgent: getUserAgent(request)
    });

    // Run auto matching
    await upsertPotentialMatchesForCase(updated);

    const hydrated = await hydrateCase(updated, true);
    return NextResponse.json({ item: hydrated });
  } catch (error) {
    console.error('[CaseDetailsPut] Error:', error);
    return NextResponse.json({ error: 'Failed to update case.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ caseId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId } = await context.params;

  try {
    const item = await prisma.caseItem.findUnique({
      where: { id: caseId }
    });

    if (!item || item.deletedAt) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    const canManage = item.ownerUserId === user.id || user.role === 'ADMIN';
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have access to delete this case.' }, { status: 403 });
    }

    // Mark as deleted, closed status
    await prisma.caseItem.update({
      where: { id: caseId },
      data: {
        deletedAt: new Date(),
        status: 'CLOSED',
        statusHistory: {
          create: {
            status: 'CLOSED',
            changedByUserId: user.id,
            note: 'Report deleted by the owner'
          }
        }
      }
    });

    // Log the deletion event in database audit log
    logAuditEvent({
      userId: user.id,
      eventType: 'CASE_DELETE',
      severity: 'warn',
      target: `case:${caseId}`,
      metadata: {
        referenceCode: item.referenceCode,
        type: item.type
      },
      ip: getClientIp(request),
      userAgent: getUserAgent(request)
    });

    // Delete matches from database
    await prisma.caseMatch.deleteMany({
      where: {
        OR: [
          { missingCaseId: caseId },
          { foundCaseId: caseId }
        ]
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Report deleted',
        body: `${item.referenceCode} was removed from your account.`,
        type: 'case'
      }
    });

    return NextResponse.json({ success: true, caseId });
  } catch (error) {
    console.error('[CaseDetailsDelete] Error:', error);
    return NextResponse.json({ error: 'Failed to delete case.' }, { status: 500 });
  }
}
