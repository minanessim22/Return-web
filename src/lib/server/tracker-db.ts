/**
 * Database helpers for tracker telemetry and admin views.
 *
 * All persistence uses Prisma → PostgreSQL (Supabase).
 */

import crypto from 'node:crypto';
import { prisma } from './db';

// ── Admin Table Summary ──────────────────────────────────────────

function getModelColumns(modelName: string): string[] {
  const defaultColumnsMap: Record<string, string[]> = {
    User: ['id', 'name', 'email', 'phone', 'role', 'status', 'createdAt', 'updatedAt', 'username'],
    UserPreference: ['id', 'userId', 'language', 'darkMode', 'notificationsEnabled', 'createdAt', 'updatedAt'],
    Session: ['id', 'userId', 'tokenHash', 'rememberMe', 'expiresAt', 'lastSeenAt', 'createdAt'],
    VerificationRequest: ['id', 'purpose', 'email', 'userId', 'codeHash', 'attemptsLeft', 'expiresAt', 'createdAt'],
    CaseItem: ['id', 'referenceCode', 'type', 'status', 'fullName', 'createdAt', 'updatedAt'],
    CaseImage: ['id', 'caseId', 'imageUrl', 'sortOrder', 'createdAt'],
    CaseStatusHistory: ['id', 'caseId', 'status', 'note', 'changedByUserId', 'createdAt'],
    CaseMatch: ['id', 'missingCaseId', 'foundCaseId', 'source', 'score', 'status', 'createdAt'],
    IdentificationProfile: ['id', 'ownerUserId', 'displayName', 'isActive', 'createdAt', 'updatedAt'],
    IdentificationEmergencyContact: ['id', 'profileId', 'contactName', 'phone', 'createdAt'],
    Device: ['id', 'ownerUserId', 'type', 'serialNumber', 'label', 'status', 'createdAt', 'updatedAt'],
    DeviceLink: ['id', 'deviceId', 'profileId', 'linkedAt'],
    GpsLocation: ['id', 'deviceId', 'latitude', 'longitude', 'recordedAt', 'createdAt'],
    LocationHistory: ['id', 'deviceId', 'lat', 'lon', 'alertType', 'source', 'recordedAt', 'receivedAt'],
    ScanEvent: ['id', 'profileId', 'deviceId', 'scanType', 'scanToken', 'scannedAt'],
    AiJob: ['id', 'requestedByUserId', 'relatedCaseId', 'jobType', 'status', 'createdAt'],
    AiJobCandidate: ['id', 'aiJobId', 'candidateCaseId', 'score', 'createdAt'],
    Conversation: ['id', 'relatedCaseId', 'createdByUserId', 'createdAt'],
    ConversationParticipant: ['id', 'conversationId', 'userId', 'joinedAt'],
    Message: ['id', 'conversationId', 'senderUserId', 'messageType', 'body', 'createdAt'],
    Notification: ['id', 'userId', 'title', 'isRead', 'createdAt'],
    RegisteredTracker: ['deviceId', 'label', 'ownerEmail', 'source', 'createdAt', 'updatedAt'],
    KeyValueStore: ['key', 'value', 'updatedAt'],
    Geofence: ['id', 'ownerUserId', 'deviceId', 'name', 'lat', 'lon', 'radiusMeters', 'createdAt'],
    AuditLog: ['id', 'userId', 'eventType', 'severity', 'createdAt']
  };
  return defaultColumnsMap[modelName] || ['id'];
}

export async function getTableSummary() {
  const models = [
    { name: 'User', table: 'users' },
    { name: 'Session', table: 'sessions' },
    { name: 'CaseItem', table: 'cases' },
    { name: 'CaseMatch', table: 'case_matches' },
    { name: 'IdentificationProfile', table: 'identification_profiles' },
    { name: 'Device', table: 'devices' },
    { name: 'GpsLocation', table: 'gps_locations' },
    { name: 'LocationHistory', table: 'location_history' },
    { name: 'ScanEvent', table: 'scan_events' },
    { name: 'Notification', table: 'notifications' },
    { name: 'VerificationRequest', table: 'verification_requests' },
    { name: 'Conversation', table: 'conversations' },
    { name: 'Geofence', table: 'geofences' }
  ];

  const summary = [];
  for (const m of models) {
    let count = 0;
    try {
      const modelName = m.name.charAt(0).toLowerCase() + m.name.slice(1);
      count = await (prisma as any)[modelName].count();
    } catch (e) {
      console.error(`Failed to get count for ${m.name}:`, e);
    }
    summary.push({
      name: m.name,
      storeKey: m.table,
      count,
      columns: getModelColumns(m.name).map(col => ({ name: col, type: 'text' }))
    });
  }
  return summary;
}

// ── Database Health ──────────────────────────────────────────────

export async function getDatabaseHealth() {
  const totalRows = (await prisma.caseItem.count()) +
    (await prisma.user.count()) +
    (await prisma.device.count());
  return {
    file: process.env.IS_SMOKE_TEST === 'true' ? 'src/data/return.db' : 'Supabase PostgreSQL (AWS / Pooler)',
    sizeBytes: 0,
    totalRows,
    walEnabled: true,
    indexedTables: ['users', 'sessions', 'cases', 'case_matches', 'location_history', 'devices', 'notifications']
  };
}

// ── Admin Table Reader ───────────────────────────────────────────

const TABLE_TO_MODEL: Record<string, string> = {
  'users': 'user',
  'sessions': 'session',
  'cases': 'caseItem',
  'case_matches': 'caseMatch',
  'case_images': 'caseImage',
  'case_status_history': 'caseStatusHistory',
  'identification_profiles': 'identificationProfile',
  'identification_emergency_contacts': 'identificationEmergencyContact',
  'devices': 'device',
  'device_links': 'deviceLink',
  'gps_locations': 'gpsLocation',
  'location_history': 'locationHistory',
  'scan_events': 'scanEvent',
  'notifications': 'notification',
  'verification_requests': 'verificationRequest',
  'conversations': 'conversation',
  'conversation_participants': 'conversationParticipant',
  'messages': 'message',
  'ai_jobs': 'aiJob',
  'ai_job_candidates': 'aiJobCandidate',
  'registered_trackers': 'registeredTracker',
  'geofences': 'geofence',
  'user_preferences': 'userPreference',
  'key_value_store': 'keyValueStore'
};

export async function readTableData(tableName: string, limit = 100, offset = 0) {
  const modelName = TABLE_TO_MODEL[tableName];
  if (!modelName) {
    throw new Error('TABLE_NOT_FOUND');
  }

  try {
    const model = (prisma as any)[modelName];
    const rows = await model.findMany({
      take: Math.min(limit, 200),
      skip: offset,
      orderBy: { createdAt: 'desc' }
    });

    return {
      table: tableName,
      rows: rows.map((payload: any) => ({
        id: payload.id,
        payload,
        payloadPreview: payload
      }))
    };
  } catch (e: any) {
    // Some models may not have createdAt — fall back to no ordering
    if (e?.message?.includes('createdAt')) {
      try {
        const model = (prisma as any)[modelName];
        const rows = await model.findMany({ take: Math.min(limit, 200), skip: offset });
        return {
          table: tableName,
          rows: rows.map((payload: any) => ({
            id: payload.id ?? payload.key,
            payload,
            payloadPreview: payload
          }))
        };
      } catch (fallbackErr) {
        console.error(`Failed to read table ${tableName}:`, fallbackErr);
        return { table: tableName, rows: [] };
      }
    }
    console.error(`Failed to read table ${tableName}:`, e);
    return { table: tableName, rows: [] };
  }
}

/** List all Prisma-managed tables with row counts */
export async function listTables() {
  const entries = Object.entries(TABLE_TO_MODEL);
  const result = [];
  for (const [tableName, modelName] of entries) {
    try {
      const count = await (prisma as any)[modelName].count();
      result.push({ name: tableName, storeKey: tableName, count, columns: [] });
    } catch {
      result.push({ name: tableName, storeKey: tableName, count: 0, columns: [] });
    }
  }
  return result;
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

  // If the deviceId is a database UUID, resolve it to the raw serial number
  let resolvedDeviceId = deviceId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId);
  if (isUuid) {
    try {
      const dev = await prisma.device.findUnique({
        where: { id: deviceId }
      });
      if (dev && dev.serialNumber) {
        resolvedDeviceId = dev.serialNumber;
      }
    } catch (err) {
      console.error('Failed to resolve device UUID to serial number:', err);
    }
  }

  const results = await prisma.locationHistory.findMany({
    where: {
      deviceId: resolvedDeviceId,
      recordedAt: { gte: from, lte: to }
    },
    orderBy: { recordedAt: 'asc' },
    take: safeLimit
  });

  return results.map((row) => ({
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
  return row !== null;
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
  return rows.map((row) => ({
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
  return rows.map((row) => ({
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
