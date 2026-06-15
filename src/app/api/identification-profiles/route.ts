import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { prisma } from '@/lib/server/db';
import {
  parseOptionalNumber,
  parseOptionalString,
  ensureSameOrigin,
  hashValue
} from '@/lib/server/security';
import { capabilitiesFromDevice } from '@/lib/device-models';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const dbProfiles = await prisma.identificationProfile.findMany({
      where: { ownerUserId: user.id },
      include: {
        emergencyContacts: true,
        deviceLinks: {
          where: { unlinkedAt: null },
          include: { device: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const formatted = dbProfiles.map((p) => {
      return {
        id: p.id,
        ownerUserId: p.ownerUserId,
        displayName: p.displayName,
        age: p.age,
        category: p.category,
        clothesColor: p.clothesColor,
        bloodType: p.bloodType,
        medicalNotes: p.medicalNotes,
        notes: p.notes,
        lastLocationText: p.lastLocationText,
        latitude: p.latitude,
        longitude: p.longitude,
        photoUrl: p.photoUrl,
        qrPublicToken: p.qrPublicToken,
        nfcTagUid: p.nfcTagUid,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        emergencyContacts: p.emergencyContacts.map(c => ({
          id: c.id,
          contactName: c.contactName,
          relation: c.relation,
          phone: c.phone
        })),
        linkedDevices: p.deviceLinks.map(link => ({
          id: link.device.id,
          serialNumber: link.device.serialNumber,
          label: link.device.label,
          type: link.device.type
        }))
      };
    });

    return NextResponse.json({ items: formatted });
  } catch (err) {
    console.error('[ProfilesGet] Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve profiles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const displayName = parseOptionalString(body.displayName ?? body.name);
  if (!displayName) {
    return NextResponse.json({ error: 'Display name is required.' }, { status: 400 });
  }

  const age = parseOptionalNumber(body.age);
  const category = parseOptionalString(body.category ?? body.type);
  const clothesColor = parseOptionalString(body.clothesColor);
  const bloodType = parseOptionalString(body.bloodType);
  const medicalNotes = parseOptionalString(body.medicalNotes);
  const notes = parseOptionalString(body.notes);
  const lastLocationText = parseOptionalString(body.lastLocationText ?? body.location);
  const latitude = parseOptionalNumber(body.latitude);
  const longitude = parseOptionalNumber(body.longitude);
  const photoUrl = parseOptionalString(body.photoUrl ?? body.photo);

  const emergencyContactsData = Array.isArray(body.emergencyContacts)
    ? body.emergencyContacts
        .filter((item: unknown) => typeof item === 'object' && item !== null)
        .map((contact: any) => ({
          contactName: String(contact.contactName || user.name),
          relation: typeof contact.relation === 'string' ? contact.relation : 'Owner',
          phone: String(contact.phone || user.phone || '')
        }))
    : [
        {
          contactName: user.name,
          relation: 'Owner',
          phone: String(parseOptionalString(body.emergencyContact) || user.phone || '')
        }
      ];

  try {
    const qrPublicToken = `qr_${randomBytes(6).toString('hex')}`;
    const profile = await prisma.identificationProfile.create({
      data: {
        ownerUserId: user.id,
        displayName,
        age,
        category,
        clothesColor,
        bloodType,
        medicalNotes,
        notes,
        lastLocationText,
        latitude,
        longitude,
        photoUrl,
        qrPublicToken,
        isActive: true,
        emergencyContacts: {
          create: emergencyContactsData
        }
      },
      include: {
        emergencyContacts: true
      }
    });

    if (body.createQrDevice) {
      const serial = `QR-${randomBytes(3).toString('hex').toUpperCase()}`;
      const capabilityPreset = capabilitiesFromDevice({ type: 'QR' });
      await prisma.device.create({
        data: {
          ownerUserId: user.id,
          type: 'QR',
          hardwareModel: 'STANDALONE',
          supportsNfc: capabilityPreset.supportsNfc,
          supportsBarcode: capabilityPreset.supportsBarcode,
          supportsGps: capabilityPreset.supportsGps,
          serialNumber: serial,
          label: `${displayName} QR Tag`,
          status: 'ACTIVE',
          trackingEnabled: false,
          links: {
            create: {
              profileId: profile.id
            }
          }
        }
      });
    }

    if (body.createGpsDevice) {
      const serial = `GPS-${randomBytes(3).toString('hex').toUpperCase()}`;
      const capabilityPreset = capabilitiesFromDevice({ type: 'GPS' });
      const hardwareToken = randomBytes(18).toString('hex').toUpperCase();
      const hardwareBridge = {
        ready: true,
        protocol: 'HTTP',
        ingressPath: '/api/hardware/devices/telemetry',
        gpsIngressPath: '/api/hardware/devices/telemetry',
        headerName: 'x-device-token',
        tokenHash: hashValue(hardwareToken),
        tokenPreview: `${hardwareToken.slice(0, 6)}...${hardwareToken.slice(-4)}`,
        tokenIssuedAt: new Date().toISOString()
      };

      const gpsDevice = await prisma.device.create({
        data: {
          ownerUserId: user.id,
          type: 'GPS',
          hardwareModel: 'STANDALONE',
          supportsNfc: capabilityPreset.supportsNfc,
          supportsBarcode: capabilityPreset.supportsBarcode,
          supportsGps: true,
          serialNumber: serial,
          label: `${displayName} GPS Bracelet`,
          status: 'ACTIVE',
          trackingEnabled: true,
          updateIntervalMinutes: 5,
          hardwareBridge: hardwareBridge as any,
          links: {
            create: {
              profileId: profile.id
            }
          }
        }
      });

      if (latitude !== undefined && longitude !== undefined) {
        await prisma.gpsLocation.create({
          data: {
            deviceId: gpsDevice.id,
            latitude,
            longitude,
            recordedAt: new Date()
          }
        });

        await prisma.locationHistory.create({
          data: {
            deviceId: gpsDevice.serialNumber,
            lat: latitude,
            lon: longitude,
            recordedAt: new Date(),
            source: 'manual_setup'
          }
        });
      }
    }

    // Retrieve full formatted profile to return
    const finalProfile = await prisma.identificationProfile.findUnique({
      where: { id: profile.id },
      include: {
        emergencyContacts: true,
        deviceLinks: {
          where: { unlinkedAt: null },
          include: { device: true }
        }
      }
    });

    const result = finalProfile ? {
      id: finalProfile.id,
      ownerUserId: finalProfile.ownerUserId,
      displayName: finalProfile.displayName,
      age: finalProfile.age,
      category: finalProfile.category,
      clothesColor: finalProfile.clothesColor,
      bloodType: finalProfile.bloodType,
      medicalNotes: finalProfile.medicalNotes,
      notes: finalProfile.notes,
      lastLocationText: finalProfile.lastLocationText,
      latitude: finalProfile.latitude,
      longitude: finalProfile.longitude,
      photoUrl: finalProfile.photoUrl,
      qrPublicToken: finalProfile.qrPublicToken,
      nfcTagUid: finalProfile.nfcTagUid,
      isActive: finalProfile.isActive,
      createdAt: finalProfile.createdAt.toISOString(),
      updatedAt: finalProfile.updatedAt.toISOString(),
      emergencyContacts: finalProfile.emergencyContacts.map(c => ({
        id: c.id,
        contactName: c.contactName,
        relation: c.relation,
        phone: c.phone
      })),
      linkedDevices: finalProfile.deviceLinks.map(link => ({
        id: link.device.id,
        serialNumber: link.device.serialNumber,
        label: link.device.label,
        type: link.device.type
      }))
    } : undefined;

    return NextResponse.json({ item: result }, { status: 201 });
  } catch (error) {
    console.error('[ProfileCreate] Error:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
