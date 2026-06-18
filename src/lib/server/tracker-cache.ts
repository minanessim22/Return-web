import { getMqttEmitter } from '@/lib/server/mqtt-bridge';
import type { TrackerLocationEvent } from '@/lib/server/mqtt-bridge';

const GLOBAL_CACHE_KEY = '__return_tracker_latest__' as const;

export type LatestEntry = {
  device_id: string;
  lat: number | null;
  lon: number | null;
  battery?: number;
  receivedAt: string;
  topic: string;
  alertType?: string;
};

export function getTrackerCache(): Map<string, LatestEntry> {
  const g = globalThis as unknown as Record<string, Map<string, LatestEntry> | undefined>;
  if (!g[GLOBAL_CACHE_KEY]) {
    g[GLOBAL_CACHE_KEY] = new Map();
    const emitter = getMqttEmitter();
    emitter.on('location', (event: TrackerLocationEvent) => {
      g[GLOBAL_CACHE_KEY]!.set(event.device_id, {
        device_id: event.device_id,
        lat: event.lat,
        lon: event.lon,
        battery: event.battery,
        receivedAt: event.receivedAt,
        topic: event.topic,
        alertType: event.alertType,
      });
    });
  }
  return g[GLOBAL_CACHE_KEY]!;
}

export function purgeDeviceFromCache(serialNumber: string): void {
  getTrackerCache().delete(serialNumber);
}
