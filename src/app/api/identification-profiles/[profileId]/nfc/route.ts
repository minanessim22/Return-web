import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin, hashValue, publicBaseUrl, sanitizePlainText } from '@/lib/server/security';
import { prisma } from '@/lib/server/db';
import { capabilitiesFromDevice, resolveHardwareModelKey } from '@/lib/device-models';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ profileId: string }> }) {
  if (!ensureSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { profileId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const requestedUid = sanitizePlainText(String(body.nfcTagUid || ''));
  const nfcTagUid = requestedUid || randomBytes(6).toString('hex').toUpperCase();
  const hardwareModel = resolveHardwareModelKey(body.hardwareModel || 'SMART_TAG_LITE');
  const capabilityPreset = capabilitiesFromDevice({ hardwareModel, type: 'NFC' });
  const hardwareToken = randomBytes(18).toString('hex').toUpperCase();

  try {
    const profile = await prisma.identificationProfile.findFirst({
      where: { id: profileId, ownerUserId: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const hardwareBridge = {
      ready: true,
      protocol: 'HTTP',
      ingressPath: '/api/hardware/nfc/scan',
      gpsIngressPath: capabilityPreset.supportsGps ? '/api/hardware/devices/telemetry' : undefined,
      publicUrl: `/identify/${profile.qrPublicToken}`,
      headerName: 'x-device-token',
      tokenHash: hashValue(hardwareToken),
      tokenPreview: `${hardwareToken.slice(0, 6)}...${hardwareToken.slice(-4)}`,
      tokenIssuedAt: new Date().toISOString()
    };

    let device: any;
    await prisma.$transaction(async (tx) => {
      // 1. Update profile with NFC Tag UID
      await tx.identificationProfile.update({
        where: { id: profileId },
        data: { nfcTagUid }
      });

      // 2. Upsert NFC Device
      device = await tx.device.upsert({
        where: { serialNumber: `NFC-${nfcTagUid}` },
        update: {
          ownerUserId: user.id,
          hardwareModel,
          supportsNfc: capabilityPreset.supportsNfc,
          supportsBarcode: capabilityPreset.supportsBarcode,
          supportsGps: capabilityPreset.supportsGps,
          label: `${profile.displayName} ${hardwareModel === 'SMART_TAG_PRO' ? 'Smart Tag Pro' : 'Smart Tag Lite'}`,
          trackingEnabled: capabilityPreset.defaultTracking,
          updateIntervalMinutes: capabilityPreset.defaultIntervalMinutes,
          hardwareBridge: hardwareBridge as any
        },
        create: {
          ownerUserId: user.id,
          type: 'NFC',
          hardwareModel,
          supportsNfc: capabilityPreset.supportsNfc,
          supportsBarcode: capabilityPreset.supportsBarcode,
          supportsGps: capabilityPreset.supportsGps,
          serialNumber: `NFC-${nfcTagUid}`,
          label: `${profile.displayName} ${hardwareModel === 'SMART_TAG_PRO' ? 'Smart Tag Pro' : 'Smart Tag Lite'}`,
          trackingEnabled: capabilityPreset.defaultTracking,
          updateIntervalMinutes: capabilityPreset.defaultIntervalMinutes,
          hardwareBridge: hardwareBridge as any
        }
      });

      // 3. Create link if not exists
      const existingLink = await tx.deviceLink.findFirst({
        where: {
          deviceId: device.id,
          profileId: profile.id,
          unlinkedAt: null
        }
      });

      if (!existingLink) {
        await tx.deviceLink.create({
          data: {
            deviceId: device.id,
            profileId: profile.id
          }
        });
      }
    });

    const baseUrl = publicBaseUrl(request);
    return NextResponse.json({
      success: true,
      nfcTagUid,
      hardwareModel,
      capabilities: {
        supportsNfc: capabilityPreset.supportsNfc,
        supportsBarcode: capabilityPreset.supportsBarcode,
        supportsGps: capabilityPreset.supportsGps
      },
      hardware: {
        ready: true,
        endpointPath: '/api/hardware/nfc/scan',
        endpointUrl: `${baseUrl}/api/hardware/nfc/scan`,
        telemetryPath: capabilityPreset.supportsGps ? '/api/hardware/devices/telemetry' : undefined,
        telemetryUrl: capabilityPreset.supportsGps ? `${baseUrl}/api/hardware/devices/telemetry` : undefined,
        headerName: 'x-device-token',
        deviceToken: hardwareToken,
        tokenPreview: `${hardwareToken.slice(0, 6)}...${hardwareToken.slice(-4)}`,
        publicUrl: `${baseUrl}/identify/${profile.qrPublicToken}`,
        deviceId: device?.id,
        serialNumber: device?.serialNumber,
        barcodeReady: true
      }
    });
  } catch (error) {
    console.error('[NfcRegister] Error:', error);
    return NextResponse.json({ error: 'Failed to register NFC Tag' }, { status: 500 });
  }
}
