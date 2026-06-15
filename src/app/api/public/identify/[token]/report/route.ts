import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { isPersonProfile } from '@/lib/profile-utils';

export const runtime = 'nodejs';

/**
 * POST /api/public/identify/[token]/report
 *
 * Called silently by the public identify page after the finder grants GPS access.
 * Creates a FoundReport + ScanEvent + Notification for the profile owner.
 *
 * Body: { finderLatitude?: number, finderLongitude?: number }
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const body = await request.json().catch(() => ({}));
  const finderLatitude = typeof body.finderLatitude === 'number' ? body.finderLatitude : null;
  const finderLongitude = typeof body.finderLongitude === 'number' ? body.finderLongitude : null;

  // Look up the profile by QR public token
  const profile = await prisma.identificationProfile.findFirst({
    where: { qrPublicToken: token, isActive: true },
    include: { emergencyContacts: true }
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  // Create a scan event to log this interaction
  const scanEvent = await prisma.scanEvent.create({
    data: {
      profileId: profile.id,
      scanType: 'QR',
      scanToken: token,
      latitude: finderLatitude ?? undefined,
      longitude: finderLongitude ?? undefined,
      metadata: {
        source: 'public_identify_page',
        hasGps: finderLatitude !== null && finderLongitude !== null
      }
    }
  });

  // Create the found report with finder GPS
  const foundReport = await prisma.foundReport.create({
    data: {
      profileId: profile.id,
      scanEventId: scanEvent.id,
      finderLatitude,
      finderLongitude,
      notifiedOwner: !!profile.ownerUserId
    }
  });

  // Persist the coordinates on the profile and all linked active devices
  if (finderLatitude !== null && finderLongitude !== null) {
    await prisma.identificationProfile.update({
      where: { id: profile.id },
      data: {
        latitude: finderLatitude,
        longitude: finderLongitude
      }
    });

    const activeLinks = await prisma.deviceLink.findMany({
      where: { profileId: profile.id, unlinkedAt: null },
      include: { device: true }
    });

    for (const link of activeLinks) {
      await prisma.gpsLocation.create({
        data: {
          deviceId: link.device.id,
          latitude: finderLatitude,
          longitude: finderLongitude,
          recordedAt: new Date()
        }
      });

      await prisma.locationHistory.create({
        data: {
          deviceId: link.device.serialNumber,
          lat: finderLatitude,
          lon: finderLongitude,
          recordedAt: new Date(),
          source: 'finder_scan'
        }
      });
    }
  }

  // Notify the profile owner
  if (profile.ownerUserId) {
    const isPerson = isPersonProfile(profile.category);
    const displayLabel = profile.displayName;

    const title = isPerson
      ? `🚨 ${displayLabel} Has Been Found!`
      : `🚨 ${displayLabel} Has Been Found!`;

    const locationNote = finderLatitude !== null && finderLongitude !== null
      ? 'Tap to view the exact location on the map.'
      : 'Location could not be determined.';

    const body = isPerson
      ? `Someone found ${displayLabel} and scanned the tag. ${locationNote}`
      : `Someone found ${displayLabel} and scanned the tag. ${locationNote}`;

    await prisma.notification.create({
      data: {
        userId: profile.ownerUserId,
        title,
        body,
        type: 'found_report'
      }
    });
  }

  return NextResponse.json({
    success: true,
    reportId: foundReport.id,
    hasGps: finderLatitude !== null && finderLongitude !== null
  });
}
