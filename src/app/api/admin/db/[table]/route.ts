import { prisma } from '@/lib/server/db';
import { apiError, apiJson, clampInteger, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';

const modelMap: Record<string, any> = {
  // Prisma model names
  User: prisma.user,
  UserPreference: prisma.userPreference,
  Session: prisma.session,
  VerificationRequest: prisma.verificationRequest,
  CaseItem: prisma.caseItem,
  CaseImage: prisma.caseImage,
  CaseStatusHistory: prisma.caseStatusHistory,
  CaseMatch: prisma.caseMatch,
  IdentificationProfile: prisma.identificationProfile,
  IdentificationEmergencyContact: prisma.identificationEmergencyContact,
  Device: prisma.device,
  DeviceLink: prisma.deviceLink,
  GpsLocation: prisma.gpsLocation,
  LocationHistory: prisma.locationHistory,
  ScanEvent: prisma.scanEvent,
  AiJob: prisma.aiJob,
  AiJobCandidate: prisma.aiJobCandidate,
  Conversation: prisma.conversation,
  ConversationParticipant: prisma.conversationParticipant,
  Message: prisma.message,
  Notification: prisma.notification,
  RegisteredTracker: prisma.registeredTracker,
  KeyValueStore: prisma.keyValueStore,
  Geofence: prisma.geofence,
  AuditLog: prisma.auditLog,

  // Plural / snake_case table names mapped to Prisma delegates
  users: prisma.user,
  user_preferences: prisma.userPreference,
  sessions: prisma.session,
  verification_requests: prisma.verificationRequest,
  cases: prisma.caseItem,
  case_images: prisma.caseImage,
  case_status_history: prisma.caseStatusHistory,
  case_matches: prisma.caseMatch,
  identification_profiles: prisma.identificationProfile,
  identification_emergency_contacts: prisma.identificationEmergencyContact,
  devices: prisma.device,
  device_links: prisma.deviceLink,
  gps_locations: prisma.gpsLocation,
  location_history: prisma.locationHistory,
  scan_events: prisma.scanEvent,
  ai_jobs: prisma.aiJob,
  ai_job_candidates: prisma.aiJobCandidate,
  conversations: prisma.conversation,
  conversation_participants: prisma.conversationParticipant,
  messages: prisma.message,
  notifications: prisma.notification,
  registered_trackers: prisma.registeredTracker,
  key_value_store: prisma.keyValueStore,
  geofences: prisma.geofence,
  audit_logs: prisma.auditLog
};

function resolveModelName(tableOrModelName: string): string | null {
  const norm = tableOrModelName.trim().toLowerCase();
  
  const map: Record<string, string> = {
    user: 'User',
    users: 'User',
    userpreference: 'UserPreference',
    user_preferences: 'UserPreference',
    session: 'Session',
    sessions: 'Session',
    verificationrequest: 'VerificationRequest',
    verification_requests: 'VerificationRequest',
    caseitem: 'CaseItem',
    cases: 'CaseItem',
    caseimage: 'CaseImage',
    case_images: 'CaseImage',
    casestatushistory: 'CaseStatusHistory',
    case_status_history: 'CaseStatusHistory',
    casematch: 'CaseMatch',
    case_matches: 'CaseMatch',
    identificationprofile: 'IdentificationProfile',
    identification_profiles: 'IdentificationProfile',
    identificationemergencycontact: 'IdentificationEmergencyContact',
    identification_emergency_contacts: 'IdentificationEmergencyContact',
    device: 'Device',
    devices: 'Device',
    devicelink: 'DeviceLink',
    device_links: 'DeviceLink',
    gpslocation: 'GpsLocation',
    gps_locations: 'GpsLocation',
    locationhistory: 'LocationHistory',
    location_history: 'LocationHistory',
    scanevent: 'ScanEvent',
    scan_events: 'ScanEvent',
    aijob: 'AiJob',
    ai_jobs: 'AiJob',
    aijobcandidate: 'AiJobCandidate',
    ai_job_candidates: 'AiJobCandidate',
    conversation: 'Conversation',
    conversations: 'Conversation',
    conversationparticipant: 'ConversationParticipant',
    conversation_participants: 'ConversationParticipant',
    message: 'Message',
    messages: 'Message',
    notification: 'Notification',
    notifications: 'Notification',
    registeredtracker: 'RegisteredTracker',
    registered_trackers: 'RegisteredTracker',
    keyvaluestore: 'KeyValueStore',
    key_value_store: 'KeyValueStore',
    geofence: 'Geofence',
    geofences: 'Geofence',
    auditlog: 'AuditLog',
    audit_logs: 'AuditLog'
  };

  return map[norm] || null;
}

function getModelColumns(modelName: string, sampleRow?: any): string[] {
  if (sampleRow) {
    return Object.keys(sampleRow);
  }
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

export async function GET(
  request: Request,
  context: { params: Promise<{ table: string }> }
) {
  const admin = await requireAdmin();
  if (admin.response) {
    return admin.response;
  }

  const resolvedParams = await context.params;
  const tableParam = resolvedParams?.table;

  if (!tableParam) {
    return apiError(400, 'Table name parameter is required.');
  }

  const modelName = resolveModelName(tableParam);
  const prismaModel = modelName ? modelMap[modelName] : null;

  if (!prismaModel) {
    return apiError(400, `Invalid table or model name: "${tableParam}"`);
  }

  const url = new URL(request.url);
  const limit = clampInteger(url.searchParams.get('limit'), 1, 200, 50);
  const offset = clampInteger(url.searchParams.get('offset'), 0, 10_000, 0);

  try {
    let rawRows;
    try {
      rawRows = await prismaModel.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      });
    } catch {
      rawRows = await prismaModel.findMany({
        take: limit,
        skip: offset
      });
    }

    const total = await prismaModel.count();

    const formattedRows = rawRows.map((row: any) => {
      const rowCopy = { ...row };
      Object.keys(rowCopy).forEach((key) => {
        if (rowCopy[key] instanceof Date) {
          rowCopy[key] = rowCopy[key].toISOString();
        }
      });
      return {
        ...rowCopy,
        payload: rowCopy,
        payloadPreview: rowCopy
      };
    });

    const columns = getModelColumns(modelName!, rawRows[0]);

    return apiJson({
      rows: formattedRows,
      total,
      columns
    });
  } catch (error) {
    console.error(`Prisma query failure for ${modelName}:`, error);
    return apiError(500, 'Prisma query failure.');
  }
}
