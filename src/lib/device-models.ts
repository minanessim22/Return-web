import type { DeviceHardwareModel, DeviceType } from '@/lib/shared-types';

export type DeviceCapabilities = {
  hardwareModel: DeviceHardwareModel;
  supportsNfc: boolean;
  supportsBarcode: boolean;
  supportsGps: boolean;
  primaryType: DeviceType;
  defaultTracking: boolean;
  defaultIntervalMinutes: number;
};

export const DEVICE_HARDWARE_MODELS: Record<DeviceHardwareModel, DeviceCapabilities & { title: string; description: string }> = {
  STANDALONE: {
    hardwareModel: 'STANDALONE',
    title: 'Standalone device',
    description: 'Single-function device such as a dedicated GPS tracker, QR tag, or NFC tag.',
    supportsNfc: false,
    supportsBarcode: false,
    supportsGps: false,
    primaryType: 'GPS',
    defaultTracking: true,
    defaultIntervalMinutes: 5
  },
  SMART_TAG_LITE: {
    hardwareModel: 'SMART_TAG_LITE',
    title: 'Smart Tag Lite',
    description: 'Hardware tag with NFC + barcode / QR access and no onboard GPS.',
    supportsNfc: true,
    supportsBarcode: true,
    supportsGps: false,
    primaryType: 'NFC',
    defaultTracking: false,
    defaultIntervalMinutes: 15
  },
  SMART_TAG_PRO: {
    hardwareModel: 'SMART_TAG_PRO',
    title: 'Smart Tag Pro',
    description: 'Hardware tag with NFC + barcode / QR + GPS telemetry.',
    supportsNfc: true,
    supportsBarcode: true,
    supportsGps: true,
    primaryType: 'NFC',
    defaultTracking: true,
    defaultIntervalMinutes: 5
  }
};

export function resolveHardwareModelKey(value: unknown): DeviceHardwareModel {
  if (value === 'SMART_TAG_LITE' || value === 'SMART_TAG_PRO' || value === 'STANDALONE') return value;
  return 'STANDALONE';
}

export function capabilitiesFromDevice(input: { hardwareModel?: unknown; type?: unknown; supportsNfc?: unknown; supportsBarcode?: unknown; supportsGps?: unknown }): DeviceCapabilities {
  const hardwareModel = resolveHardwareModelKey(input.hardwareModel);
  const preset = DEVICE_HARDWARE_MODELS[hardwareModel];
  const type = input.type === 'NFC' || input.type === 'QR' || input.type === 'GPS' ? input.type : preset.primaryType;
  const standaloneCapabilities = {
    supportsNfc: type === 'NFC',
    supportsBarcode: type === 'QR',
    supportsGps: type === 'GPS'
  };
  const supportsNfc = typeof input.supportsNfc === 'boolean' ? input.supportsNfc : hardwareModel === 'STANDALONE' ? standaloneCapabilities.supportsNfc : preset.supportsNfc;
  const supportsBarcode = typeof input.supportsBarcode === 'boolean' ? input.supportsBarcode : hardwareModel === 'STANDALONE' ? standaloneCapabilities.supportsBarcode : preset.supportsBarcode;
  const supportsGps = typeof input.supportsGps === 'boolean' ? input.supportsGps : hardwareModel === 'STANDALONE' ? standaloneCapabilities.supportsGps : preset.supportsGps;
  return {
    hardwareModel,
    supportsNfc,
    supportsBarcode,
    supportsGps,
    primaryType: type,
    defaultTracking: hardwareModel === 'STANDALONE' ? supportsGps : preset.defaultTracking,
    defaultIntervalMinutes: hardwareModel === 'STANDALONE' ? (supportsGps ? 5 : 15) : preset.defaultIntervalMinutes
  };
}

export function getHardwareModelLabel(model: DeviceHardwareModel) {
  return DEVICE_HARDWARE_MODELS[model].title;
}
