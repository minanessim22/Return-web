import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/session';
import { ensureSameOrigin, hashValue, publicBaseUrl, sanitizePlainText } from '@/lib/server/security';
import { createOrUpdateDevice, readStore, updateStore } from '@/lib/server/store';
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
    await updateStore((store) => {
      const profile = store.identificationProfiles.find((item) => item.id === profileId && item.ownerUserId === user.id);
      if (!profile) {
        throw new Error('NOT_FOUND');
      }
      profile.nfcTagUid = nfcTagUid;
      profile.updatedAt = new Date().toISOString();
      createOrUpdateDevice(store, {
        ownerUserId: user.id,
        type: 'NFC',
        hardwareModel,
        supportsNfc: capabilityPreset.supportsNfc,
        supportsBarcode: capabilityPreset.supportsBarcode,
        supportsGps: capabilityPreset.supportsGps,
        serialNumber: `NFC-${nfcTagUid}`,
        label: `${profile.displayName} ${hardwareModel === 'SMART_TAG_PRO' ? 'Smart Tag Pro' : 'Smart Tag Lite'}`,
        linkedProfileId: profile.id,
        trackingEnabled: capabilityPreset.defaultTracking,
        updateIntervalMinutes: capabilityPreset.defaultIntervalMinutes,
        hardwareBridge: {
          ready: true,
          protocol: 'HTTP',
          ingressPath: '/api/hardware/nfc/scan',
          gpsIngressPath: capabilityPreset.supportsGps ? '/api/hardware/devices/telemetry' : undefined,
          publicUrl: `/identify/${profile.qrPublicToken}`,
          headerName: 'x-device-token',
          tokenHash: hashValue(hardwareToken),
          tokenPreview: `${hardwareToken.slice(0, 6)}...${hardwareToken.slice(-4)}`,
          tokenIssuedAt: new Date().toISOString()
        }
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }
    throw error;
  }

  const store = await readStore();
  const profile = store.identificationProfiles.find((item) => item.id === profileId && item.ownerUserId === user.id);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }
  const device = store.devices.find((item) => item.ownerUserId === user.id && item.type === 'NFC' && item.linkedProfileId === profile.id && item.serialNumber === `NFC-${profile.nfcTagUid}`);
  const baseUrl = publicBaseUrl(request);
  return NextResponse.json({
    success: true,
    nfcTagUid: profile.nfcTagUid,
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
      tokenPreview: device?.hardwareBridge?.tokenPreview || `${hardwareToken.slice(0, 6)}...${hardwareToken.slice(-4)}`,
      publicUrl: `${baseUrl}/identify/${profile.qrPublicToken}`,
      deviceId: device?.id,
      serialNumber: device?.serialNumber,
      barcodeReady: true
    }
  });
}
