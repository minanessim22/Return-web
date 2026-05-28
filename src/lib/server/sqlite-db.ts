import crypto from 'node:crypto';
import { prisma } from './db';

// ── JSON Store Persistence ────────────────────────────────────────

const STORE_KEY = 'MAIN_APP_STORE_V1';

export async function readRawStoreFromSqlite(): Promise<any> {
  try {
    const row = await prisma.keyValueStore.findUnique({
      where: { key: STORE_KEY }
    });
    if (row && row.value) {
      return JSON.parse(row.value);
    }
    return null;
  } catch (err) {
    console.error('[Supabase DB] Failed to read store:', err);
    return null;
  }
}

export async function writeRawStoreToSqlite(storeData: any): Promise<void> {
  try {
    await prisma.keyValueStore.upsert({
      where: { key: STORE_KEY },
      update: { value: JSON.stringify(storeData) },
      create: { key: STORE_KEY, value: JSON.stringify(storeData) }
    });
  } catch (err) {
    console.error('[Supabase DB] Failed to write store:', err);
  }
}

export async function getSqliteSummary() {
  const store = await readRawStoreFromSqlite() || {};
  return Object.keys(store).map((key) => {
    const items = store[key];
    return {
      name: key,
      storeKey: key,
      count: Array.isArray(items) ? items.length : 0,
      columns: []
    };
  });
}

export async function readSqliteTable(tableName: string, limit = 100, offset = 0) {
  const store = await readRawStoreFromSqlite() || {};
  const items = store[tableName] || [];
  return {
    table: tableName,
    rows: items.slice(offset, offset + limit).map((payload: any) => ({
      id: payload.id,
      payload,
      payloadPreview: payload
    }))
  };
}

export async function getSqliteHealth() {
  const row = await prisma.keyValueStore.findUnique({ where: { key: STORE_KEY } });
  return {
    file: 'Supabase Postgres (KeyValueStore)',
    sizeBytes: row ? Buffer.byteLength(row.value, 'utf8') : 0,
    totalRows: 1,
    walEnabled: true,
    indexedTables: ['LocationHistory', 'RegisteredTrackers']
  };
}

// ── Location History API ──────────────────────────────────────────

export interface LocationHistoryRow {
  id: string;
  device_id: string;
  lat: number;
  lon: number;
  battery: number | null;
  altitude: number | null;
  speed: number | null;
  accuracy: number | null;
  bearing: number | null;
  alert_type: string;
  source: string;
  recorded_at: string;
  received_at: string;
}

export async function insertLocationHistory(row: Omit<LocationHistoryRow, 'id'>) {
  try {
    await prisma.locationHistory.create({
      data: {
        id: crypto.randomUUID(),
        deviceId: row.device_id,
        lat: row.lat,
        lon: row.lon,
        battery: row.battery ? Math.round(row.battery) : null,
        altitude: row.altitude,
        speed: row.speed,
        accuracy: row.accuracy,
        bearing: row.bearing,
        alertType: row.alert_type,
        source: row.source,
        recordedAt: new Date(row.recorded_at),
        receivedAt: new Date(row.received_at),
      }
    });
  } catch (err) {
    console.error('Failed to insert location history:', err);
  }
}

export async function insertLocationHistoryBatch(rows: Omit<LocationHistoryRow, 'id'>[]) {
  let saved = 0;
  let skipped = 0;
  try {
    const data = rows.map(row => ({
      id: crypto.randomUUID(),
      deviceId: row.device_id,
      lat: row.lat,
      lon: row.lon,
      battery: row.battery ? Math.round(row.battery) : null,
      altitude: row.altitude,
      speed: row.speed,
      accuracy: row.accuracy,
      bearing: row.bearing,
      alertType: row.alert_type,
      source: row.source,
      recordedAt: new Date(row.recorded_at),
      receivedAt: new Date(row.received_at),
    }));
    const result = await prisma.locationHistory.createMany({
      data,
      skipDuplicates: true
    });
    saved = result.count;
    skipped = rows.length - saved;
  } catch (err) {
    console.error('Failed to batch insert location history:', err);
  }
  return { saved, skipped };
}

export async function getLocationHistory(deviceId: string, fromIso?: string, toIso?: string, limit = 500) {
  const from = fromIso ? new Date(fromIso) : new Date(0);
  const to = toIso ? new Date(toIso) : new Date();
  const safeLimit = Math.min(Math.max(1, limit), 2000);

  const results = await prisma.locationHistory.findMany({
    where: {
      deviceId,
      recordedAt: { gte: from, lte: to }
    },
    orderBy: { recordedAt: 'asc' },
    take: safeLimit
  });

  return results.map((row: any) => ({
    id: row.id,
    device_id: row.deviceId,
    lat: row.lat,
    lon: row.lon,
    battery: row.battery,
    altitude: row.altitude,
    speed: row.speed,
    accuracy: row.accuracy,
    bearing: row.bearing,
    alert_type: row.alertType || '',
    source: row.source || 'api',
    recorded_at: row.recordedAt.toISOString(),
    received_at: row.receivedAt.toISOString()
  }));
}

// ── Registered Trackers API ───────────────────────────────────────

export interface RegisteredTracker {
  device_id: string;
  label: string | null;
  owner_email: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export async function isTrackerRegistered(deviceId: string): Promise<boolean> {
  const row = await prisma.registeredTracker.findUnique({
    where: { deviceId }
  });
  if (row !== null) return true;

  // Fallback to checking the JSON store and auto-syncing
  const store = await readRawStoreFromSqlite();
  if (store && Array.isArray(store.devices)) {
    const found = store.devices.find((d: any) => d.serialNumber === deviceId || d.id === deviceId);
    if (found) {
      await registerTracker(deviceId, found.label, undefined, 'auto-sync').catch(() => {});
      return true;
    }
  }
  return false;
}

export async function registerTracker(deviceId: string, label?: string, ownerEmail?: string, source = 'manual'): Promise<boolean> {
  const existing = await prisma.registeredTracker.findUnique({ where: { deviceId } });
  if (existing) {
    await prisma.registeredTracker.update({
      where: { deviceId },
      data: {
        label: label ?? existing.label,
        ownerEmail: ownerEmail ?? existing.ownerEmail,
      }
    });
    return false;
  }

  await prisma.registeredTracker.create({
    data: { deviceId, label, ownerEmail, source }
  });
  return true;
}

export async function unregisterTracker(deviceId: string): Promise<boolean> {
  try {
    await prisma.registeredTracker.delete({ where: { deviceId } });
    return true;
  } catch {
    return false;
  }
}

export async function listRegisteredTrackers(): Promise<RegisteredTracker[]> {
  const rows = await prisma.registeredTracker.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((row: any) => ({
    device_id: row.deviceId,
    label: row.label,
    owner_email: row.ownerEmail,
    source: row.source,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  }));
}

export async function listRegisteredTrackersForEmail(email: string): Promise<RegisteredTracker[]> {
  const normalized = email.trim().toLowerCase();
  const rows = await prisma.registeredTracker.findMany({
    where: {
      ownerEmail: {
        equals: normalized,
        mode: 'insensitive'
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  return rows.map((row: any) => ({
    device_id: row.deviceId,
    label: row.label,
    owner_email: row.ownerEmail,
    source: row.source,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  }));
}

export async function getRegisteredTracker(deviceId: string): Promise<RegisteredTracker | null> {
  const row = await prisma.registeredTracker.findUnique({ where: { deviceId } });
  if (!row) return null;
  return {
    device_id: row.deviceId,
    label: row.label,
    owner_email: row.ownerEmail,
    source: row.source,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  };
}
