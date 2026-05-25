import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readRawStoreFromSqlite, writeRawStoreToSqlite } from '@/lib/server/sqlite-db';
import { capabilitiesFromDevice } from '@/lib/device-models';
import type {
  AuditLogItem,
  CaseItem,
  CaseRecord,
  CaseStatus,
  CaseType,
  ConversationDetail,
  ConversationMessage,
  ConversationMessageItem,
  ConversationRecord,
  ConversationSummary,
  AdminSummaryResponse,
  DashboardSummaryResponse,
  DeviceItem,
  DeviceLocationRecord,
  HydratedMatch,
  IdentificationProfile,
  MatchRecord,
  NotificationItem,
  PublicUser,
  PublicUserPreview,
  ScanEvent,
  SessionRecord,
  Store,
  StoredPreference,
  StoredUser,
  VerificationPurpose,
  VerificationRequest,
  CaseAiAnalysis
} from '@/lib/shared-types';
import { compareAiVisualFeatures } from '@/lib/visual-ai';
import { ACCEPTED_MATCH_THRESHOLD, compareImageSetsWithKairos, getMatchDecision, MANUAL_REVIEW_THRESHOLD } from '@/lib/server/kairos-face';
import { dateToIso, generateNumericCode, getPasswordStrengthMessage, hashValue, isStrongPassword, isValidEmail, normalizeEmail, normalizePhone, normalizeUsername, sanitizePlainText, slugifyName } from '@/lib/server/security';

const DEFAULT_LANGUAGE: StoredPreference['language'] = 'en';
const MIN_VISIBLE_IMAGE_SCORE = 0.75;
const MIN_POTENTIAL_MATCH_SCORE = 0.8;

export const defaultPreference: StoredPreference = {
  language: DEFAULT_LANGUAGE,
  darkMode: false,
  notificationsEnabled: true,
  gpsIntervalMinutes: 5,
  showContactToFinder: true,
  hideSensitiveDetails: false,
  allowEmergencyLocation: true,
  enableQr: true,
  enableNfc: true,
  enableGps: true,
  enableBluetooth: true,
  enableWifi: true,
  matchAlerts: true,
  foundCaseUpdates: true,
  nearbyAlerts: false,
  deviceAlerts: true,
  autoDownloadQr: false,
  ownerMessages: true,
  locationRequests: true,
  autoOpenProfile: true,
  systemAnalysis: true
};

export function createId(prefix = 'id') {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function isManagedDeviceType(type?: DeviceItem['type']) {
  return type === 'GPS' || type === 'QR' || type === 'NFC';
}

function caseHasConfirmedMatch(store: Store, caseId: string) {
  return store.matches.some((item) => item.status === 'CONFIRMED' && (item.caseId === caseId || item.otherCaseId === caseId));
}

export function isCaseEligibleForAutoMatching(store: Store, item?: CaseRecord) {
  if (!item || item.deletedAt) return false;
  if (item.status === 'DRAFT' || item.status === 'RESOLVED' || item.status === 'CLOSED') return false;
  if (caseHasConfirmedMatch(store, item.id)) return false;
  return true;
}

function pruneUnmatchablePendingMatches(store: Store) {
  store.matches = store.matches.filter((match) => {
    if (match.status !== 'PENDING') return true;
    const leftCase = store.cases.find((item) => item.id === match.caseId && !item.deletedAt);
    const rightCase = store.cases.find((item) => item.id === match.otherCaseId && !item.deletedAt);
    if (!leftCase || !rightCase) {
      return false;
    }
    return isCaseEligibleForAutoMatching(store, leftCase) && isCaseEligibleForAutoMatching(store, rightCase);
  });
}

function normalizeAiAnalysis(input: any): CaseAiAnalysis | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const features = typeof input.features === 'object' && input.features !== null ? input.features : undefined;
  if (!features) {
    return undefined;
  }

  const averageHash = typeof features.averageHash === 'string' ? features.averageHash : undefined;
  const differenceHash = typeof features.differenceHash === 'string' ? features.differenceHash : undefined;
  const structureHash = typeof features.structureHash === 'string' ? features.structureHash : undefined;
  const centerAverageHash = typeof features.centerAverageHash === 'string' ? features.centerAverageHash : undefined;
  const centerDifferenceHash = typeof features.centerDifferenceHash === 'string' ? features.centerDifferenceHash : undefined;
  const focusAverageHash = typeof features.focusAverageHash === 'string' ? features.focusAverageHash : undefined;
  const focusDifferenceHash = typeof features.focusDifferenceHash === 'string' ? features.focusDifferenceHash : undefined;
  const focusStructureHash = typeof features.focusStructureHash === 'string' ? features.focusStructureHash : undefined;
  const quadrantHashes = Array.isArray(features.quadrantHashes)
    ? features.quadrantHashes
        .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
        .slice(0, 4)
    : undefined;
  const gradientHistogram = Array.isArray(features.gradientHistogram)
    ? features.gradientHistogram
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value))
        .slice(0, 8)
    : undefined;
  const rowProfile = Array.isArray(features.rowProfile)
    ? features.rowProfile
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value))
        .slice(0, 8)
    : undefined;
  const columnProfile = Array.isArray(features.columnProfile)
    ? features.columnProfile
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value))
        .slice(0, 8)
    : undefined;
  const colorHistogram = Array.isArray(features.colorHistogram)
    ? features.colorHistogram
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value))
        .slice(0, 12)
    : [];

  if (!averageHash || !differenceHash || colorHistogram.length === 0) {
    return undefined;
  }

  return {
    summary: typeof input.summary === 'string' && input.summary.trim() ? input.summary.trim() : 'AI visual profile ready.',
    generatedAt: typeof input.generatedAt === 'string' && input.generatedAt.trim() ? input.generatedAt : nowIso(),
    features: {
      version: Number(features.version) === 3 ? 3 : Number(features.version) === 2 ? 2 : 1,
      averageHash,
      differenceHash,
      structureHash,
      centerAverageHash,
      centerDifferenceHash,
      focusAverageHash,
      focusDifferenceHash,
      focusStructureHash,
      quadrantHashes,
      gradientHistogram,
      rowProfile,
      columnProfile,
      colorHistogram,
      brightness: Number.isFinite(Number(features.brightness)) ? Number(features.brightness) : 0,
      edgeDensity: Number.isFinite(Number(features.edgeDensity)) ? Number(features.edgeDensity) : 0,
      centerEdgeDensity: Number.isFinite(Number(features.centerEdgeDensity)) ? Number(features.centerEdgeDensity) : undefined,
      aspectRatio: Number.isFinite(Number(features.aspectRatio)) ? Number(features.aspectRatio) : 1,
      width: Number.isFinite(Number(features.width)) ? Number(features.width) : 0,
      height: Number.isFinite(Number(features.height)) ? Number(features.height) : 0
    }
  };
}

function normalizeUser(input: any): StoredUser {
  const usernameSeed = input.username || input.name || input.email || 'user';
  return {
    id: String(input.id || createId('user')),
    name: String(input.name || 'Unnamed User'),
    username: normalizeUsername(String(input.username || slugifyName(String(usernameSeed)) || `user-${Math.random().toString(36).slice(2, 8)}`)),
    email: normalizeEmail(String(input.email || 'unknown@return.local')),
    phone: normalizePhone(String(input.phone || '')),
    dateOfBirth: input.dateOfBirth ? String(input.dateOfBirth) : undefined,
    passwordHash: String(input.passwordHash || hashLegacyPassword('password123')),
    avatarUrl: input.avatarUrl ? String(input.avatarUrl) : undefined,
    role: input.role === 'ADMIN' || input.role === 'OPERATOR' ? input.role : 'USER',
    status: ['PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DELETED'].includes(input.status) ? input.status : 'ACTIVE',
    emailVerifiedAt: input.emailVerifiedAt ? String(input.emailVerifiedAt) : undefined,
    lastLoginAt: input.lastLoginAt ? String(input.lastLoginAt) : undefined,
    failedLoginCount: Number.isFinite(Number(input.failedLoginCount)) ? Number(input.failedLoginCount) : 0,
    lockedUntil: input.lockedUntil ? String(input.lockedUntil) : undefined,
    createdAt: input.createdAt ? String(input.createdAt) : nowIso(),
    updatedAt: input.updatedAt ? String(input.updatedAt) : nowIso(),
    preference: {
      ...defaultPreference,
      ...(input.preference || {}),
      language: input.preference?.language === 'ar' ? 'ar' : 'en'
    }
  };
}

function normalizeSession(input: any): SessionRecord {
  return {
    id: String(input.id || createId('session')),
    userId: String(input.userId || ''),
    tokenHash: String(input.tokenHash || hashValue(String(input.token || ''))),
    csrfToken: input.csrfToken ? String(input.csrfToken) : undefined,
    rememberMe: input.rememberMe !== false,
    userAgent: input.userAgent ? String(input.userAgent) : undefined,
    ipHash: input.ipHash ? String(input.ipHash) : undefined,
    expiresAt: input.expiresAt ? String(input.expiresAt) : nowIso(),
    lastSeenAt: input.lastSeenAt ? String(input.lastSeenAt) : nowIso(),
    createdAt: input.createdAt ? String(input.createdAt) : nowIso()
  };
}

function normalizeCase(input: any): CaseRecord {
  return {
    id: String(input.id || createId('case')),
    referenceCode: String(input.referenceCode || 'RTN-0000'),
    ownerUserId: String(input.ownerUserId || ''),
    type: input.type === 'FOUND' ? 'FOUND' : 'MISSING',
    status: ['DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'MATCHED', 'RESOLVED', 'CLOSED'].includes(input.status) ? input.status : 'ACTIVE',
    category: input.category ? String(input.category) : undefined,
    fullName: input.fullName ? String(input.fullName) : undefined,
    estimatedName: input.estimatedName ? String(input.estimatedName) : undefined,
    age: Number.isFinite(Number(input.age)) ? Number(input.age) : undefined,
    gender: input.gender ? String(input.gender) : undefined,
    description: input.description ? String(input.description) : undefined,
    clothesColor: input.clothesColor ? String(input.clothesColor) : undefined,
    conditionNotes: input.conditionNotes ? String(input.conditionNotes) : undefined,
    contactPhone: input.contactPhone ? String(input.contactPhone) : undefined,
    locationText: input.locationText ? String(input.locationText) : undefined,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : undefined,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
    eventTime: input.eventTime ? String(input.eventTime) : undefined,
    lastSeenAt: input.lastSeenAt ? String(input.lastSeenAt) : undefined,
    foundAt: input.foundAt ? String(input.foundAt) : undefined,
    createdAt: input.createdAt ? String(input.createdAt) : nowIso(),
    updatedAt: input.updatedAt ? String(input.updatedAt) : nowIso(),
    deletedAt: input.deletedAt ? String(input.deletedAt) : undefined,
    images: Array.isArray(input.images)
      ? input.images.map((image: any, index: number) => ({
          id: String(image.id || createId('img')),
          imageUrl: String(image.imageUrl || image.url || ''),
          sortOrder: Number.isFinite(Number(image.sortOrder)) ? Number(image.sortOrder) : index,
          createdAt: image.createdAt ? String(image.createdAt) : nowIso()
        }))
      : [],
    statusHistory: Array.isArray(input.statusHistory)
      ? input.statusHistory.map((entry: any) => ({
          id: String(entry.id || createId('history')),
          status: ['DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'MATCHED', 'RESOLVED', 'CLOSED'].includes(entry.status) ? entry.status : 'ACTIVE',
          changedByUserId: entry.changedByUserId ? String(entry.changedByUserId) : undefined,
          note: entry.note ? String(entry.note) : undefined,
          createdAt: entry.createdAt ? String(entry.createdAt) : nowIso()
        }))
      : [],
    aiAnalysis: normalizeAiAnalysis(input.aiAnalysis)
  };
}

function normalizeDevice(input: any): DeviceItem {
  const type = input.type === 'NFC' ? 'NFC' : input.type === 'QR' ? 'QR' : input.type === 'BLUETOOTH' ? 'BLUETOOTH' : input.type === 'WIFI' ? 'WIFI' : 'GPS';
  const capabilities = capabilitiesFromDevice({
    hardwareModel: input.hardwareModel,
    type,
    supportsNfc: input.supportsNfc,
    supportsBarcode: input.supportsBarcode,
    supportsGps: input.supportsGps
  });
  return {
    id: String(input.id || createId('device')),
    ownerUserId: String(input.ownerUserId || ''),
    type,
    hardwareModel: capabilities.hardwareModel,
    supportsNfc: capabilities.supportsNfc,
    supportsBarcode: capabilities.supportsBarcode,
    supportsGps: capabilities.supportsGps,
    serialNumber: String(input.serialNumber || `DEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`),
    label: String(input.label || 'Device'),
    status: ['ACTIVE', 'PAUSED', 'DISCONNECTED', 'LOW_BATTERY', 'INACTIVE'].includes(input.status) ? input.status : 'ACTIVE',
    batteryLevel: Number.isFinite(Number(input.batteryLevel)) ? Number(input.batteryLevel) : undefined,
    updateIntervalMinutes: Number.isFinite(Number(input.updateIntervalMinutes)) ? Number(input.updateIntervalMinutes) : undefined,
    trackingEnabled: typeof input.trackingEnabled === 'boolean' ? input.trackingEnabled : capabilities.defaultTracking,
    linkedProfileId: input.linkedProfileId ? String(input.linkedProfileId) : undefined,
    lastLocationText: input.lastLocationText ? String(input.lastLocationText) : undefined,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : undefined,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
    locationHistory: Array.isArray(input.locationHistory)
      ? input.locationHistory.map((entry: any) => ({
          id: String(entry.id || createId('loc')),
          deviceId: String(entry.deviceId || input.id || ''),
          latitude: Number(entry.latitude),
          longitude: Number(entry.longitude),
          accuracyMeters: Number.isFinite(Number(entry.accuracyMeters)) ? Number(entry.accuracyMeters) : undefined,
          address: entry.address ? String(entry.address) : undefined,
          source: entry.source ? String(entry.source) : undefined,
          createdAt: entry.createdAt ? String(entry.createdAt) : nowIso()
        }))
      : [],
    hardwareBridge: input.hardwareBridge && typeof input.hardwareBridge === 'object'
      ? {
          ready: input.hardwareBridge.ready !== false,
          protocol: 'HTTP',
          ingressPath: input.hardwareBridge.ingressPath ? String(input.hardwareBridge.ingressPath) : '/api/hardware/nfc/scan',
          headerName: input.hardwareBridge.headerName ? String(input.hardwareBridge.headerName) : 'x-device-token',
          tokenHash: input.hardwareBridge.tokenHash ? String(input.hardwareBridge.tokenHash) : undefined,
          tokenPreview: input.hardwareBridge.tokenPreview ? String(input.hardwareBridge.tokenPreview) : undefined,
          tokenIssuedAt: input.hardwareBridge.tokenIssuedAt ? String(input.hardwareBridge.tokenIssuedAt) : undefined,
          lastSeenAt: input.hardwareBridge.lastSeenAt ? String(input.hardwareBridge.lastSeenAt) : undefined,
          lastEventAt: input.hardwareBridge.lastEventAt ? String(input.hardwareBridge.lastEventAt) : undefined,
          lastTagUid: input.hardwareBridge.lastTagUid ? String(input.hardwareBridge.lastTagUid) : undefined,
          gpsIngressPath: input.hardwareBridge.gpsIngressPath ? String(input.hardwareBridge.gpsIngressPath) : undefined,
          publicUrl: input.hardwareBridge.publicUrl ? String(input.hardwareBridge.publicUrl) : undefined
        }
      : undefined,
    createdAt: input.createdAt ? String(input.createdAt) : nowIso(),
    updatedAt: input.updatedAt ? String(input.updatedAt) : nowIso()
  };
}

function normalizeProfile(input: any): IdentificationProfile {
  return {
    id: String(input.id || createId('profile')),
    ownerUserId: String(input.ownerUserId || ''),
    displayName: String(input.displayName || input.name || 'Unnamed profile'),
    age: Number.isFinite(Number(input.age)) ? Number(input.age) : undefined,
    category: input.category ? String(input.category) : undefined,
    clothesColor: input.clothesColor ? String(input.clothesColor) : undefined,
    bloodType: input.bloodType ? String(input.bloodType) : undefined,
    medicalNotes: input.medicalNotes ? String(input.medicalNotes) : undefined,
    notes: input.notes ? String(input.notes) : undefined,
    lastLocationText: input.lastLocationText ? String(input.lastLocationText) : undefined,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : undefined,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
    photoUrl: input.photoUrl ? String(input.photoUrl) : undefined,
    qrPublicToken: String(input.qrPublicToken || `qr_${randomBytes(6).toString('hex')}`),
    nfcTagUid: input.nfcTagUid ? String(input.nfcTagUid) : undefined,
    isActive: input.isActive !== false,
    emergencyContacts: Array.isArray(input.emergencyContacts)
      ? input.emergencyContacts.map((entry: any) => ({
          id: String(entry.id || createId('contact')),
          contactName: String(entry.contactName || 'Emergency Contact'),
          relation: entry.relation ? String(entry.relation) : undefined,
          phone: String(entry.phone || '')
        }))
      : [],
    createdAt: input.createdAt ? String(input.createdAt) : nowIso(),
    updatedAt: input.updatedAt ? String(input.updatedAt) : nowIso()
  };
}

function normalizeNotification(input: any): NotificationItem {
  return {
    id: String(input.id || createId('notif')),
    userId: String(input.userId || ''),
    title: String(input.title || 'Notification'),
    body: String(input.body || ''),
    type: input.type || 'system',
    relatedCaseId: input.relatedCaseId ? String(input.relatedCaseId) : undefined,
    actionUrl: input.actionUrl ? String(input.actionUrl) : undefined,
    isRead: input.isRead === true,
    readAt: input.readAt ? String(input.readAt) : undefined,
    createdAt: input.createdAt ? String(input.createdAt) : nowIso()
  };
}

function normalizeVerification(input: any): VerificationRequest {
  return {
    id: String(input.id || createId('verify')),
    purpose: ['REGISTER', 'RESET_PASSWORD', 'CHANGE_EMAIL'].includes(input.purpose) ? input.purpose : 'REGISTER',
    email: normalizeEmail(String(input.email || '')),
    userId: input.userId ? String(input.userId) : undefined,
    codeHash: String(input.codeHash || ''),
    attemptsLeft: Number.isFinite(Number(input.attemptsLeft)) ? Number(input.attemptsLeft) : 5,
    expiresAt: input.expiresAt ? String(input.expiresAt) : new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    consumedAt: input.consumedAt ? String(input.consumedAt) : undefined,
    payload: typeof input.payload === 'object' && input.payload !== null ? input.payload : undefined,
    createdAt: input.createdAt ? String(input.createdAt) : nowIso()
  };
}

function normalizeAuditLog(input: any): AuditLogItem {
  return {
    id: String(input.id || createId('audit')),
    event: String(input.event || 'unknown_event'),
    severity: input.severity === 'warning' || input.severity === 'error' ? input.severity : 'info',
    userId: input.userId ? String(input.userId) : undefined,
    ipHash: input.ipHash ? String(input.ipHash) : undefined,
    userAgent: input.userAgent ? String(input.userAgent) : undefined,
    details: typeof input.details === 'object' && input.details !== null ? input.details : undefined,
    createdAt: input.createdAt ? String(input.createdAt) : nowIso()
  };
}

function normalizeScanEvent(input: any): ScanEvent {
  return {
    id: String(input.id || createId('scan')),
    profileId: String(input.profileId || ''),
    type: input.type === 'NFC' ? 'NFC' : 'QR',
    rawValue: input.rawValue ? String(input.rawValue) : undefined,
    finderName: input.finderName ? String(input.finderName) : undefined,
    finderPhone: input.finderPhone ? String(input.finderPhone) : undefined,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : undefined,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
    locationText: input.locationText ? String(input.locationText) : undefined,
    createdAt: input.createdAt ? String(input.createdAt) : nowIso()
  };
}

function normalizeConversation(input: any): ConversationRecord {
  return {
    id: String(input.id || createId('conv')),
    createdByUserId: String(input.createdByUserId || ''),
    title: input.title ? String(input.title) : undefined,
    relatedCaseId: input.relatedCaseId ? String(input.relatedCaseId) : undefined,
    relatedMatchId: input.relatedMatchId ? String(input.relatedMatchId) : undefined,
    caseIds: Array.isArray(input.caseIds) ? input.caseIds.map((value: any) => String(value)) : undefined,
    participants: Array.isArray(input.participants)
      ? input.participants.map((entry: any) => ({
          id: String(entry.id || createId('participant')),
          conversationId: String(entry.conversationId || input.id || ''),
          userId: String(entry.userId || ''),
          joinedAt: entry.joinedAt ? String(entry.joinedAt) : nowIso()
        }))
      : [],
    messages: Array.isArray(input.messages)
      ? input.messages.map((entry: any) => ({
          id: String(entry.id || createId('msg')),
          conversationId: String(entry.conversationId || input.id || ''),
          senderUserId: String(entry.senderUserId || ''),
          body: String(entry.body || ''),
          type: entry.type === 'SYSTEM' ? 'SYSTEM' : 'TEXT',
          createdAt: entry.createdAt ? String(entry.createdAt) : nowIso()
        }))
      : [],
    createdAt: input.createdAt ? String(input.createdAt) : nowIso(),
    updatedAt: input.updatedAt ? String(input.updatedAt) : nowIso()
  };
}

function normalizeStore(raw: any): Store {
  return {
    users: Array.isArray(raw?.users) ? raw.users.map(normalizeUser) : [],
    sessions: Array.isArray(raw?.sessions) ? raw.sessions.map(normalizeSession) : [],
    verificationRequests: Array.isArray(raw?.verificationRequests) ? raw.verificationRequests.map(normalizeVerification) : [],
    cases: Array.isArray(raw?.cases) ? raw.cases.map(normalizeCase) : [],
    matches: Array.isArray(raw?.matches)
      ? raw.matches.map((entry: any) => ({
          id: String(entry.id || createId('match')),
          caseId: String(entry.caseId || ''),
          otherCaseId: String(entry.otherCaseId || ''),
          score: Number.isFinite(Number(entry.score)) ? Number(entry.score) : 0.5,
          reason: String(entry.reason || 'Potential match'),
          status: ['PENDING', 'CONFIRMED', 'REJECTED'].includes(entry.status) ? entry.status : 'PENDING',
          createdAt: entry.createdAt ? String(entry.createdAt) : nowIso(),
          confirmationRequestedAt: entry.confirmationRequestedAt ? String(entry.confirmationRequestedAt) : undefined,
          confirmationRequestedByUserId: entry.confirmationRequestedByUserId ? String(entry.confirmationRequestedByUserId) : undefined,
          confirmedAt: entry.confirmedAt ? String(entry.confirmedAt) : undefined,
          confirmedByUserId: entry.confirmedByUserId ? String(entry.confirmedByUserId) : undefined,
          imageScore: Number.isFinite(Number(entry.imageScore)) ? Number(entry.imageScore) : undefined,
          similarity: Number.isFinite(Number(entry.similarity)) ? Number(entry.similarity) : undefined,
          confidence: Number.isFinite(Number(entry.confidence)) ? Number(entry.confidence) : undefined,
          aiPriorityApplied: entry.aiPriorityApplied === true,
          usedOnlineAi: entry.usedOnlineAi === true,
          decision: ['Accepted Match', 'Manual Review', 'No Match'].includes(entry.decision) ? entry.decision : getMatchDecision(Number(entry.score)).decision,
          manualReview: entry.manualReview === true || getMatchDecision(Number(entry.score)).manualReview,
          scoreBreakdown: typeof entry.scoreBreakdown === 'object' && entry.scoreBreakdown !== null ? {
            category: Number.isFinite(Number(entry.scoreBreakdown.category)) ? Number(entry.scoreBreakdown.category) : 0,
            location: Number.isFinite(Number(entry.scoreBreakdown.location)) ? Number(entry.scoreBreakdown.location) : 0,
            description: Number.isFinite(Number(entry.scoreBreakdown.description)) ? Number(entry.scoreBreakdown.description) : 0,
            image: Number.isFinite(Number(entry.scoreBreakdown.image)) ? Number(entry.scoreBreakdown.image) : undefined
          } : undefined
        }))
      : [],
    notifications: Array.isArray(raw?.notifications) ? raw.notifications.map(normalizeNotification) : [],
    devices: Array.isArray(raw?.devices) ? raw.devices.map(normalizeDevice) : [],
    identificationProfiles: Array.isArray(raw?.identificationProfiles) ? raw.identificationProfiles.map(normalizeProfile) : [],
    scanEvents: Array.isArray(raw?.scanEvents) ? raw.scanEvents.map(normalizeScanEvent) : [],
    auditLogs: Array.isArray(raw?.auditLogs) ? raw.auditLogs.map(normalizeAuditLog) : [],
    conversations: Array.isArray(raw?.conversations) ? raw.conversations.map(normalizeConversation) : []
  };
}


function refreshStoredPotentialMatches(store: Store, options: { notifyOnNewMatch?: boolean } = {}) {
  const before = JSON.stringify({
    matches: store.matches,
    statuses: store.cases.map((item) => ({ id: item.id, status: item.status, history: item.statusHistory.length }))
  });

  pruneUnmatchablePendingMatches(store);
  for (const caseItem of store.cases.filter((item) => isCaseEligibleForAutoMatching(store, item))) {
    upsertPotentialMatchesForCase(store, caseItem, options);
  }
  pruneUnmatchablePendingMatches(store);
  syncAllCaseStatusesFromMatches(store);

  const after = JSON.stringify({
    matches: store.matches,
    statuses: store.cases.map((item) => ({ id: item.id, status: item.status, history: item.statusHistory.length }))
  });

  return before !== after;
}

export function reconcileStoredMatchState(store: Store) {
  const before = JSON.stringify({
    matches: store.matches.map((item) => ({
      id: item.id,
      caseId: item.caseId,
      otherCaseId: item.otherCaseId,
      status: item.status,
      confirmationRequestedAt: item.confirmationRequestedAt
    })),
    statuses: store.cases.map((item) => ({ id: item.id, status: item.status, history: item.statusHistory.length }))
  });

  pruneUnmatchablePendingMatches(store);
  syncAllCaseStatusesFromMatches(store);

  const after = JSON.stringify({
    matches: store.matches.map((item) => ({
      id: item.id,
      caseId: item.caseId,
      otherCaseId: item.otherCaseId,
      status: item.status,
      confirmationRequestedAt: item.confirmationRequestedAt
    })),
    statuses: store.cases.map((item) => ({ id: item.id, status: item.status, history: item.statusHistory.length }))
  });

  return before !== after;
}

function pruneVolatileRecords(store: Store) {
  const now = nowIso();
  const nextSessions = store.sessions.filter((item) => item.expiresAt > now);
  const nextVerificationRequests = store.verificationRequests.filter((item) => {
    if (item.consumedAt) return false;
    return item.expiresAt > now && item.attemptsLeft > 0;
  });
  const changed = nextSessions.length !== store.sessions.length || nextVerificationRequests.length !== store.verificationRequests.length;
  if (changed) {
    store.sessions = nextSessions;
    store.verificationRequests = nextVerificationRequests;
  }
  return changed;
}

let storeWriteChain: Promise<void> = Promise.resolve();

function queueStoreWrite<T>(operation: () => Promise<T>) {
  const run = storeWriteChain.catch(() => undefined).then(operation);
  storeWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

async function waitForPendingWrites() {
  await storeWriteChain.catch(() => undefined);
}

let globalStoreCache: Store | null = null;

async function readStoreSnapshot(): Promise<Store> {
  if (globalStoreCache) {
    return JSON.parse(JSON.stringify(globalStoreCache));
  }
  try {
    globalStoreCache = normalizeStore(await readRawStoreFromSqlite());
    return JSON.parse(JSON.stringify(globalStoreCache));
  } catch (error) {
    console.warn('Supabase store unavailable, using empty store.', error);
    globalStoreCache = normalizeStore({});
    return JSON.parse(JSON.stringify(globalStoreCache));
  }
}

async function persistStore(normalized: Store) {
  globalStoreCache = normalizeStore(normalized);
  try {
    await writeRawStoreToSqlite(normalized);
  } catch (error) {
    console.warn('Unable to persist store to Supabase.', error);
  }
}

export async function readStore(): Promise<Store> {
  const store = await readStoreSnapshot();
  const changed = pruneVolatileRecords(store) || reconcileStoredMatchState(store);
  if (changed) {
    await queueStoreWrite(async () => {
      await persistStore(normalizeStore(store));
    });
  }
  return store;
}

export async function writeStore(store: Store) {
  const normalized = normalizeStore(store);
  return queueStoreWrite(async () => {
    await persistStore(normalized);
  });
}

export async function updateStore(mutator: (draft: Store) => void | Promise<void>) {
  return queueStoreWrite(async () => {
    const draft = await readStoreSnapshot();
    pruneVolatileRecords(draft);
    await mutator(draft);
    const normalized = normalizeStore(draft);
    await persistStore(normalized);
    return normalized;
  });
}

function bufferEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function hashLegacyPassword(password: string) {
  return `sha256:${createHash('sha256').update(password).digest('hex')}`;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  if (!passwordHash) return false;
  if (passwordHash.startsWith('scrypt:')) {
    const [, salt, derived] = passwordHash.split(':');
    const computed = scryptSync(password, salt, 64).toString('hex');
    return bufferEquals(computed, derived);
  }
  if (passwordHash.startsWith('sha256:')) {
    return bufferEquals(hashLegacyPassword(password), passwordHash);
  }
  return false;
}

export function passwordNeedsMigration(passwordHash: string) {
  return passwordHash.startsWith('sha256:');
}

export function sanitizeUser(user: StoredUser): PublicUser {
  const {
    passwordHash: _passwordHash,
    failedLoginCount: _failedLoginCount,
    lockedUntil: _lockedUntil,
    ...rest
  } = user;
  return rest;
}

export function toUserPreview(user?: StoredUser | PublicUser | null): PublicUserPreview | undefined {
  if (!user) return undefined;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    username: user.username,
    dateOfBirth: user.dateOfBirth
  };
}

export function findUserByIdentifier(store: Store, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return store.users.find((user) => {
    return user.email.toLowerCase() === normalized || user.username.toLowerCase() === normalized || user.name.toLowerCase() === normalized;
  });
}

const MAX_PLAIN_TEXT_LENGTH = 500;
const MAX_INLINE_IMAGE_LENGTH = 12_000_000;

function isInlineImageValue(value: string) {
  return /^data:image\/[a-z0-9.+-]+(?:;[a-z0-9=:+-]+)*,/i.test(value);
}

export function parseOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const sanitized = sanitizePlainText(value).trim();
  if (!sanitized.length) {
    return undefined;
  }
  const maxLength = isInlineImageValue(sanitized) ? MAX_INLINE_IMAGE_LENGTH : MAX_PLAIN_TEXT_LENGTH;
  return sanitized.slice(0, maxLength);
}

export function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalDate(value: unknown) {
  return dateToIso(value);
}

export function inferCategory(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return 'child';
  }
  if (['child', 'elderly', 'pet', 'document', 'bag', 'vehicle', 'adult male', 'adult female', 'car', 'motorcycle', 'bicycle'].includes(normalized)) {
    return normalized;
  }
  return normalized;
}

function normalizeText(value?: string) {
  return value
    ?.toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '';
}

function tokenize(value?: string) {
  return normalizeText(value)
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function overlapRatio(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  return overlap / Math.max(leftSet.size, rightSet.size, 1);
}

function categoryFamily(value?: string) {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  if (['child', 'elderly', 'adult male', 'adult female', 'person', 'people', 'man', 'woman'].includes(normalized)) return 'person';
  if (['pet', 'dog', 'cat', 'animal'].includes(normalized)) return 'pet';
  if (['car', 'motorcycle', 'bicycle', 'vehicle'].includes(normalized)) return 'vehicle';
  if (['document', 'bag', 'phone', 'wallet', 'keys', 'item', 'belonging'].includes(normalized)) return 'item';
  return normalized;
}

function distanceKm(left: CaseRecord, right: CaseRecord) {
  if (left.latitude === undefined || left.longitude === undefined || right.latitude === undefined || right.longitude === undefined) {
    return undefined;
  }
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(right.latitude - left.latitude);
  const dLng = toRad(right.longitude - left.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(left.latitude)) * Math.cos(toRad(right.latitude)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function getComparisonDate(item: CaseRecord) {
  return item.lastSeenAt || item.foundAt || item.eventTime || item.createdAt;
}

export function generateUniqueUsername(store: Store, seedName: string, email?: string) {
  const base = normalizeUsername(email?.split('@')[0] || slugifyName(seedName) || 'user');
  let username = base || `user${Math.floor(Math.random() * 1000)}`;
  let counter = 1;
  while (store.users.some((user) => user.username === username)) {
    username = `${base || 'user'}${counter}`;
    counter += 1;
  }
  return username;
}

function buildDisplayName(item: CaseRecord) {
  return item.fullName || item.estimatedName || 'Unknown case';
}

export function recordAuditLog(
  store: Store,
  input: Omit<AuditLogItem, 'id' | 'createdAt'> & { createdAt?: string }
) {
  store.auditLogs.unshift({
    id: createId('audit'),
    event: input.event,
    severity: input.severity,
    userId: input.userId,
    ipHash: input.ipHash,
    userAgent: input.userAgent,
    details: input.details,
    createdAt: input.createdAt || nowIso()
  });
}

export function createNotification(
  store: Store,
  userId: string,
  title: string,
  body: string,
  type: NotificationItem['type'],
  relatedCaseId?: string,
  actionUrl?: string
) {
  const notification: NotificationItem = {
    id: createId('notif'),
    userId,
    title,
    body,
    type,
    relatedCaseId,
    actionUrl,
    isRead: false,
    createdAt: nowIso()
  };
  store.notifications.unshift(notification);
  return notification;
}

export function createUserAccount(
  store: Store,
  input: {
    name: string;
    email: string;
    username?: string;
    phone?: string;
    dateOfBirth?: string;
    passwordHash: string;
    avatarUrl?: string;
    role?: StoredUser['role'];
    status?: StoredUser['status'];
    preference?: Partial<StoredPreference>;
    createdAt?: string;
  }
) {
  const now = input.createdAt || nowIso();
  const name = sanitizePlainText(String(input.name || '').trim()) || 'New User';
  const email = normalizeEmail(String(input.email || ''));
  const username = input.username ? normalizeUsername(String(input.username || '')) : generateUniqueUsername(store, name, email);

  if (!isValidEmail(email)) {
    throw new Error('INVALID_EMAIL');
  }
  if (!username) {
    throw new Error('INVALID_USERNAME');
  }
  if (store.users.some((entry) => entry.email === email && entry.status !== 'DELETED')) {
    throw new Error('EMAIL_TAKEN');
  }
  if (store.users.some((entry) => entry.username === username && entry.status !== 'DELETED')) {
    throw new Error('USERNAME_TAKEN');
  }

  const createdUser: StoredUser = {
    id: createId('user'),
    name,
    username,
    email,
    phone: normalizePhone(String(input.phone || '')),
    dateOfBirth: typeof input.dateOfBirth === 'string' ? input.dateOfBirth.trim() || undefined : undefined,
    passwordHash: input.passwordHash,
    avatarUrl: typeof input.avatarUrl === 'string' ? input.avatarUrl : '/photos/7.png',
    role: input.role || 'USER',
    status: input.status || 'ACTIVE',
    emailVerifiedAt: now,
    lastLoginAt: now,
    failedLoginCount: 0,
    createdAt: now,
    updatedAt: now,
    preference: {
      ...defaultPreference,
      ...(input.preference || {}),
      language: input.preference?.language === 'ar' ? 'ar' : defaultPreference.language
    }
  };

  store.users.unshift(createdUser);
  createNotification(store, createdUser.id, 'Welcome to RETURN', 'Your account is ready and you can start using the platform right away.', 'system');
  return createdUser;
}

export function getAdminUserStats(store: Store) {
  const currentUsers = store.users.filter((item) => item.status !== 'DELETED').length;
  const activeUsers = store.users.filter((item) => item.status === 'ACTIVE').length;
  const deletedUsers = store.users.filter((item) => item.status === 'DELETED').length;
  return {
    users: currentUsers,
    currentUsers,
    activeUsers,
    deletedUsers,
    totalRows: store.users.length
  };
}

export function createVerificationRequest(
  store: Store,
  input: {
    purpose: VerificationPurpose;
    email: string;
    userId?: string;
    payload?: Record<string, unknown>;
    expiresInMinutes?: number;
  }
) {
  const code = generateNumericCode(6);
  const request: VerificationRequest = {
    id: createId('verify'),
    purpose: input.purpose,
    email: normalizeEmail(input.email),
    userId: input.userId,
    codeHash: hashValue(code),
    attemptsLeft: 5,
    expiresAt: new Date(Date.now() + (input.expiresInMinutes || 10) * 60 * 1000).toISOString(),
    payload: input.payload,
    createdAt: nowIso()
  };

  store.verificationRequests = store.verificationRequests.filter((entry) => {
    return !(entry.purpose === request.purpose && entry.email === request.email && !entry.consumedAt);
  });
  store.verificationRequests.unshift(request);
  return { request, code };
}

export function verifyOneTimeCode(
  store: Store,
  input: { purpose: VerificationPurpose; email: string; code: string }
) {
  const email = normalizeEmail(input.email);
  const entry = store.verificationRequests.find((item) => item.purpose === input.purpose && item.email === email && !item.consumedAt);
  if (!entry) {
    return { ok: false as const, reason: 'No active verification request was found.' };
  }
  if (entry.expiresAt <= nowIso()) {
    return { ok: false as const, reason: 'This code has expired. Please request a new one.' };
  }
  if (entry.attemptsLeft <= 0) {
    return { ok: false as const, reason: 'Too many invalid attempts. Please request a new code.' };
  }
  if (!bufferEquals(hashValue(input.code), entry.codeHash)) {
    entry.attemptsLeft -= 1;
    return { ok: false as const, reason: 'The verification code is incorrect.' };
  }
  entry.consumedAt = nowIso();
  return { ok: true as const, entry };
}


type PersonMetadataStrengthInput = {
  exactCategory: boolean;
  sameFamily: boolean;
  locationScore: number;
  descriptionScore: number;
  nameSimilarity: number;
  sameGender: boolean;
  ageGap?: number;
  hardMetadataConflict: boolean;
};

function assessPersonMetadataStrength(input: PersonMetadataStrengthInput) {
  const strongMetadataSignals = [
    input.exactCategory || input.sameFamily,
    input.locationScore >= 0.68,
    input.locationScore >= 0.92,
    input.descriptionScore >= 0.55,
    input.nameSimilarity >= 0.55,
    input.sameGender,
    input.ageGap !== undefined && input.ageGap <= 3
  ].filter(Boolean).length;

  const strongMetadataAccepted = !input.hardMetadataConflict &&
    (input.exactCategory || input.sameFamily) &&
    input.sameGender &&
    (input.ageGap === undefined || input.ageGap <= 3) &&
    (
      (input.locationScore >= 0.68 && input.descriptionScore >= 0.55) ||
      (input.locationScore >= 0.92 && (input.nameSimilarity >= 0.45 || input.descriptionScore >= 0.4)) ||
      (input.descriptionScore >= 0.72 && input.nameSimilarity >= 0.45)
    ) &&
    strongMetadataSignals >= 5;

  const strongMetadataReview = !input.hardMetadataConflict &&
    (input.exactCategory || input.sameFamily) &&
    (
      (input.locationScore >= 0.4 && input.descriptionScore >= 0.45) ||
      (input.locationScore >= 0.68 && input.sameGender) ||
      (input.descriptionScore >= 0.55 && input.sameGender)
    ) &&
    strongMetadataSignals >= 4;

  return {
    strongMetadataSignals,
    strongMetadataAccepted,
    strongMetadataReview: strongMetadataAccepted || strongMetadataReview
  };
}


type ComparisonSignals = {
  exactCategory: boolean;
  sameFamily: boolean;
  leftFamily?: ReturnType<typeof categoryFamily>;
  rightFamily?: ReturnType<typeof categoryFamily>;
  nameSimilarity: number;
  appearanceSimilarity: number;
  descriptionSimilarity: number;
  categoryScore: number;
  locationScore: number;
  descriptionScore: number;
  sameGender: boolean;
  differentGender: boolean;
  ageGap?: number;
  hardMetadataConflict: boolean;
  metadataStrength?: ReturnType<typeof assessPersonMetadataStrength>;
  supportingSignals: number;
  reasons: string[];
  metadataScore: number;
};

function buildComparisonSignals(left: CaseRecord, right: CaseRecord): ComparisonSignals {
  const reasons: string[] = [];

  const exactCategory = Boolean(left.category && right.category && normalizeText(left.category) === normalizeText(right.category));
  const leftFamily = categoryFamily(left.category);
  const rightFamily = categoryFamily(right.category);
  const sameFamily = Boolean(leftFamily && rightFamily && leftFamily === rightFamily);

  const leftNameTokens = tokenize([buildDisplayName(left), left.description, left.category].filter(Boolean).join(' '));
  const rightNameTokens = tokenize([buildDisplayName(right), right.description, right.category].filter(Boolean).join(' '));
  const nameSimilarity = overlapRatio(leftNameTokens, rightNameTokens);
  const appearanceSimilarity = overlapRatio(tokenize([left.clothesColor, left.conditionNotes].filter(Boolean).join(' ')), tokenize([right.clothesColor, right.conditionNotes].filter(Boolean).join(' ')));
  const descriptionSimilarity = overlapRatio(tokenize([left.description, left.conditionNotes].filter(Boolean).join(' ')), tokenize([right.description, right.conditionNotes].filter(Boolean).join(' ')));
  const locationSimilarity = overlapRatio(tokenize(left.locationText), tokenize(right.locationText));
  const geoDistance = distanceKm(left, right);

  let categoryScore = 0;
  if (exactCategory) {
    categoryScore = 1;
    reasons.push('same category');
  } else if (sameFamily) {
    categoryScore = 0.65;
    reasons.push('same item group');
  } else if (!leftFamily || !rightFamily) {
    categoryScore = 0.2;
  }

  let locationScore = 0;
  if (geoDistance !== undefined) {
    if (geoDistance <= 1) {
      locationScore = 1;
      reasons.push('same map location');
    } else if (geoDistance <= 5) {
      locationScore = 0.9;
      reasons.push('within 5km');
    } else if (geoDistance <= 15) {
      locationScore = 0.72;
      reasons.push('nearby on map');
    } else if (geoDistance <= 50) {
      locationScore = 0.45;
    } else if (geoDistance <= 120) {
      locationScore = 0.18;
    }
  }
  if (locationSimilarity >= 0.6) {
    locationScore = Math.max(locationScore, 0.92);
    if (!reasons.includes('same map location')) reasons.push('same area');
  } else if (locationSimilarity >= 0.35) {
    locationScore = Math.max(locationScore, 0.68);
    if (!reasons.includes('same area')) reasons.push('nearby area');
  } else if (locationSimilarity >= 0.18) {
    locationScore = Math.max(locationScore, 0.4);
  }

  const descriptionScore = Math.max(descriptionSimilarity, appearanceSimilarity * 0.9, nameSimilarity * 0.85);
  if (descriptionSimilarity >= 0.55) {
    reasons.push('highly similar description');
  } else if (appearanceSimilarity >= 0.45) {
    reasons.push('matching appearance or clothing');
  } else if (nameSimilarity >= 0.55) {
    reasons.push('similar name or report details');
  }

  const sameGender = Boolean(left.gender && right.gender && normalizeText(left.gender) === normalizeText(right.gender));
  const differentGender = Boolean(left.gender && right.gender && !sameGender);
  const ageGap = left.age !== undefined && right.age !== undefined ? Math.abs(left.age - right.age) : undefined;
  const hardMetadataConflict = Boolean(
    (leftFamily === 'person' && rightFamily === 'person' && differentGender) ||
    (leftFamily === 'person' && rightFamily === 'person' && ageGap !== undefined && ageGap >= 12)
  );

  const metadataStrength = leftFamily === 'person' && rightFamily === 'person'
    ? assessPersonMetadataStrength({
        exactCategory,
        sameFamily,
        locationScore,
        descriptionScore,
        nameSimilarity,
        sameGender,
        ageGap,
        hardMetadataConflict
      })
    : undefined;

  let metadataScore = (categoryScore * 0.24) + (locationScore * 0.23) + (descriptionScore * 0.21);

  if (sameGender) {
    metadataScore += 0.06;
    reasons.push('same gender');
  } else if (differentGender && leftFamily === 'person' && rightFamily === 'person') {
    metadataScore -= 0.16;
  }

  if (ageGap !== undefined) {
    if (ageGap <= 1) {
      metadataScore += 0.08;
      reasons.push('very close age');
    } else if (ageGap <= 3) {
      metadataScore += 0.05;
      reasons.push('close age');
    } else if (ageGap >= 8) {
      metadataScore -= 0.12;
    }
  }

  const leftDate = getComparisonDate(left);
  const rightDate = getComparisonDate(right);
  if (leftDate && rightDate) {
    const gapHours = Math.abs(new Date(leftDate).getTime() - new Date(rightDate).getTime()) / (1000 * 60 * 60);
    if (Number.isFinite(gapHours)) {
      if (gapHours <= 24) {
        metadataScore += 0.05;
        reasons.push('same day timeline');
      } else if (gapHours <= 72) {
        metadataScore += 0.03;
        reasons.push('close timeline');
      } else if (gapHours >= 24 * 120) {
        metadataScore -= 0.04;
      }
    }
  }

  const supportingSignals = [
    categoryScore >= 0.65,
    locationScore >= 0.68,
    descriptionSimilarity >= 0.3,
    appearanceSimilarity >= 0.3,
    nameSimilarity >= 0.4,
    ageGap !== undefined && ageGap <= 3,
    sameGender
  ].filter(Boolean).length;

  return {
    exactCategory,
    sameFamily,
    leftFamily,
    rightFamily,
    nameSimilarity,
    appearanceSimilarity,
    descriptionSimilarity,
    categoryScore,
    locationScore,
    descriptionScore,
    sameGender,
    differentGender,
    ageGap,
    hardMetadataConflict,
    metadataStrength,
    supportingSignals,
    reasons,
    metadataScore: Math.max(0, Math.min(Number(metadataScore.toFixed(4)), 0.98))
  };
}

function finalizeHybridMatchResult(
  left: CaseRecord,
  right: CaseRecord,
  signals: ComparisonSignals,
  options: {
    imageScore?: number;
    confidence?: number;
    usedOnlineAi: boolean;
    aiAssistLabel?: string;
    skippedImageMessage?: string;
  }
) {
  const reasons = [...signals.reasons];
  const aiPriorityApplied = options.imageScore !== undefined;
  const roundedImageScore = options.imageScore !== undefined ? Number(options.imageScore.toFixed(2)) : undefined;
  let weightedScore = signals.metadataScore;

  if (!signals.sameFamily && !signals.exactCategory) {
    weightedScore = Math.min(weightedScore, 0.39);
  }

  if (aiPriorityApplied && roundedImageScore !== undefined) {
    weightedScore += roundedImageScore * 0.18;
    if (roundedImageScore >= 0.92) {
      reasons.push('the image helper found a very strong face similarity');
    } else if (roundedImageScore >= ACCEPTED_MATCH_THRESHOLD) {
      reasons.push('the image helper found a strong face similarity');
    } else if (roundedImageScore >= MANUAL_REVIEW_THRESHOLD) {
      reasons.push('the image helper found a partial face similarity');
    } else {
      reasons.push('the image helper stayed weak, so the report data carried more weight');
    }
  } else if (options.skippedImageMessage) {
    reasons.push(options.skippedImageMessage);
  }

  if (signals.leftFamily === 'person' && signals.rightFamily === 'person') {
    if (signals.hardMetadataConflict) {
      weightedScore = Math.min(weightedScore, aiPriorityApplied && (roundedImageScore || 0) >= 0.95 ? 0.72 : 0.62);
    }

    if (!aiPriorityApplied && signals.supportingSignals < 2) {
      weightedScore = Math.min(weightedScore, 0.64);
    }

    if (aiPriorityApplied && roundedImageScore !== undefined) {
      if (roundedImageScore < 0.45 && signals.supportingSignals < 3) {
        weightedScore = Math.min(weightedScore, 0.54);
      } else if (roundedImageScore < MANUAL_REVIEW_THRESHOLD && signals.supportingSignals < 4) {
        weightedScore = Math.min(weightedScore, 0.74);
      }

      if (!signals.hardMetadataConflict && (signals.exactCategory || signals.sameFamily)) {
        if (roundedImageScore >= 0.94 && signals.supportingSignals >= 3) {
          weightedScore = Math.max(weightedScore, 0.84);
        } else if (roundedImageScore >= ACCEPTED_MATCH_THRESHOLD && signals.supportingSignals >= 3) {
          weightedScore = Math.max(weightedScore, 0.76);
        } else if (roundedImageScore >= MANUAL_REVIEW_THRESHOLD && signals.supportingSignals >= 2) {
          weightedScore = Math.max(weightedScore, 0.68);
        }
      }

      if (roundedImageScore >= 0.92 && signals.supportingSignals < 3) {
        weightedScore = Math.min(Math.max(weightedScore, 0.74), 0.79);
      }
    }
  } else if (aiPriorityApplied && roundedImageScore !== undefined && (signals.exactCategory || signals.sameFamily)) {
    if (roundedImageScore >= 0.9) {
      weightedScore = Math.max(weightedScore, 0.78);
    } else if (roundedImageScore >= MANUAL_REVIEW_THRESHOLD) {
      weightedScore = Math.max(weightedScore, 0.68);
    }
  }

  if (signals.metadataStrength?.strongMetadataAccepted) {
    weightedScore = Math.max(weightedScore, 0.84);
    reasons.push(aiPriorityApplied && (roundedImageScore || 0) < MANUAL_REVIEW_THRESHOLD
      ? 'strong metadata alignment compensated for a weak image helper score'
      : 'strong metadata alignment');
  } else if (signals.metadataStrength?.strongMetadataReview) {
    weightedScore = Math.max(weightedScore, 0.68);
    reasons.push(aiPriorityApplied && (roundedImageScore || 0) < MANUAL_REVIEW_THRESHOLD
      ? 'strong metadata alignment kept this match for manual review'
      : 'strong metadata alignment kept this match visible');
  }

  const finalScore = Math.max(0, Math.min(Number(weightedScore.toFixed(2)), 0.98));
  const decisionInfo = getMatchDecision(finalScore);
  const reasonPrefix = aiPriorityApplied && roundedImageScore !== undefined
    ? `${options.aiAssistLabel || 'Data-first matching used the photo as a helper'} (${Math.round(roundedImageScore * 100)}% image similarity)`
    : 'Data-first possible match';

  return {
    score: finalScore,
    reason: reasons.length ? `${reasonPrefix}: ${[...new Set(reasons)].join(', ')}.` : `${reasonPrefix}.`,
    imageScore: roundedImageScore,
    similarity: roundedImageScore,
    confidence: options.confidence !== undefined ? Number(options.confidence.toFixed(2)) : (roundedImageScore ?? finalScore),
    aiPriorityApplied,
    usedOnlineAi: options.usedOnlineAi,
    decision: decisionInfo.decision,
    manualReview: decisionInfo.manualReview,
    scoreBreakdown: {
      category: Number(signals.categoryScore.toFixed(2)),
      location: Number(signals.locationScore.toFixed(2)),
      description: Number(signals.descriptionScore.toFixed(2)),
      image: roundedImageScore,
      metadata: Number(signals.metadataScore.toFixed(2)),
      final: finalScore
    }
  };
}


export function scorePotentialMatch(left: CaseRecord, right: CaseRecord) {
  const signals = buildComparisonSignals(left, right);
  const hasImageAi = Boolean(left.images.length && right.images.length && left.aiAnalysis?.features && right.aiAnalysis?.features);
  const imageComparison = compareAiVisualFeatures(left.aiAnalysis?.features, right.aiAnalysis?.features);
  const imageScore = hasImageAi ? imageComparison.score : undefined;

  return finalizeHybridMatchResult(left, right, signals, {
    imageScore,
    usedOnlineAi: false,
    aiAssistLabel: 'Data-first matching used the visual analysis as a helper'
  });
}



async function scorePotentialMatchWithOnlineFaceAi(left: CaseRecord, right: CaseRecord) {
  const leftFamily = categoryFamily(left.category);
  const rightFamily = categoryFamily(right.category);
  if (leftFamily !== 'person' || rightFamily !== 'person') {
    return undefined;
  }

  const onlineComparison = await compareImageSetsWithKairos(
    left.images.map((item) => item.imageUrl),
    right.images.map((item) => item.imageUrl)
  );

  if (!onlineComparison.usedOnlineAi) {
    return undefined;
  }

  const signals = buildComparisonSignals(left, right);

  if (onlineComparison.similarity === undefined) {
    const helperReason = onlineComparison.warnings.find((entry) => /no face|multiple faces|invalid image|jpg|png/i.test(entry))
      || 'the image helper could not find one clear face on both reports';

    return finalizeHybridMatchResult(
      { ...left, aiAnalysis: undefined, images: [] } as CaseRecord,
      { ...right, aiAnalysis: undefined, images: [] } as CaseRecord,
      signals,
      {
        usedOnlineAi: true,
        aiAssistLabel: 'Data-first matching kept the photo as a helper',
        skippedImageMessage: helperReason
      }
    );
  }

  return finalizeHybridMatchResult(left, right, signals, {
    imageScore: onlineComparison.similarity,
    confidence: onlineComparison.confidence ?? onlineComparison.similarity,
    usedOnlineAi: true,
    aiAssistLabel: 'Data-first matching kept the photo as a helper'
  });
}


export async function scorePotentialMatchAsync(left: CaseRecord, right: CaseRecord) {
  const onlineResult = await scorePotentialMatchWithOnlineFaceAi(left, right);
  if (onlineResult) {
    return onlineResult;
  }
  return scorePotentialMatch(left, right);
}

const POTENTIAL_MATCH_THRESHOLD = MIN_POTENTIAL_MATCH_SCORE;
const REVIEW_OR_BETTER_MATCH_THRESHOLD = MANUAL_REVIEW_THRESHOLD;


function findConversationForCases(store: Store, caseIds: string[]) {
  const needle = [...new Set(caseIds)].sort().join(':');
  return store.conversations.find((conversation) => {
    const ids = [...new Set(conversation.caseIds || [])].sort().join(':');
    return ids.length > 0 && ids === needle;
  });
}

function syncCaseStatusFromMatches(caseItem: CaseRecord, matches: MatchRecord[]) {
  const hasConfirmed = matches.some((item) => item.status === 'CONFIRMED');
  const hasPending = matches.some((item) => item.status === 'PENDING');
  const previousStatus = caseItem.status;

  if (hasConfirmed) {
    if (previousStatus !== 'CLOSED') {
      caseItem.status = caseItem.type === 'MISSING' ? 'CLOSED' : 'RESOLVED';
    }
  } else if (hasPending) {
    if (previousStatus === 'ACTIVE' || previousStatus === 'UNDER_REVIEW' || previousStatus === 'MATCHED') {
      caseItem.status = 'MATCHED';
    }
  } else if (previousStatus === 'MATCHED') {
    caseItem.status = 'ACTIVE';
  }

  if (caseItem.status !== previousStatus) {
    caseItem.statusHistory.unshift({
      id: createId('history'),
      status: caseItem.status,
      note: hasConfirmed
        ? caseItem.type === 'MISSING'
          ? 'Final match confirmed and missing report closed'
          : 'Final match confirmed and found report resolved'
        : hasPending
          ? 'Potential match detected'
          : 'Match cleared',
      createdAt: nowIso()
    });
  }
}

function syncAllCaseStatusesFromMatches(store: Store) {
  for (const item of store.cases) {
    const relatedMatches = store.matches.filter((match) => (match.caseId === item.id || match.otherCaseId === item.id) && match.status !== 'REJECTED');
    syncCaseStatusFromMatches(item, relatedMatches);
  }
}

export function upsertPotentialMatchesForCase(
  store: Store,
  sourceCase: CaseRecord,
  options: { notifyOnNewMatch?: boolean } = {}
) {
  const notifyOnNewMatch = options.notifyOnNewMatch !== false;
  pruneUnmatchablePendingMatches(store);

  if (!isCaseEligibleForAutoMatching(store, sourceCase)) {
    syncAllCaseStatusesFromMatches(store);
    return;
  }

  const candidates = store.cases.filter(
    (item) => isCaseEligibleForAutoMatching(store, item) && item.id !== sourceCase.id && item.type !== sourceCase.type
  );

  for (const candidate of candidates) {
    const [missingCase, foundCase] = sourceCase.type === 'MISSING' ? [sourceCase, candidate] : [candidate, sourceCase];
    const { score, reason, imageScore, similarity, confidence, aiPriorityApplied, usedOnlineAi, decision, manualReview, scoreBreakdown } = scorePotentialMatch(missingCase, foundCase);
    const existing = store.matches.find((item) => item.caseId === missingCase.id && item.otherCaseId === foundCase.id);

    if (score < POTENTIAL_MATCH_THRESHOLD) {
      if (existing && existing.status === 'PENDING' && existing.usedOnlineAi !== true) {
        store.matches = store.matches.filter((item) => item.id !== existing.id);
      }
      continue;
    }

    if (existing) {
      if (existing.status === 'REJECTED') continue;
      if (existing.usedOnlineAi === true) {
        continue;
      }
      existing.score = score;
      existing.reason = reason;
      existing.imageScore = imageScore;
      existing.similarity = similarity;
      existing.confidence = confidence;
      existing.aiPriorityApplied = aiPriorityApplied;
      existing.usedOnlineAi = usedOnlineAi;
      existing.decision = decision;
      existing.manualReview = manualReview;
      existing.scoreBreakdown = scoreBreakdown;
      continue;
    }

    store.matches.unshift({
      id: createId('match'),
      caseId: missingCase.id,
      otherCaseId: foundCase.id,
      score,
      reason,
      status: 'PENDING',
      createdAt: nowIso(),
      imageScore,
      similarity,
      confidence,
      aiPriorityApplied,
      usedOnlineAi,
      decision,
      manualReview,
      scoreBreakdown
    });

    if (!notifyOnNewMatch) {
      continue;
    }

    const missingOwner = store.users.find((user) => user.id === missingCase.ownerUserId);
    const foundOwner = store.users.find((user) => user.id === foundCase.ownerUserId);
    if (missingOwner) {
      createNotification(store, missingOwner.id, 'Possible match detected', `A found report may match ${buildDisplayName(missingCase)}.`, 'match', missingCase.id, `/case-details?caseId=${missingCase.id}&view=matches`);
    }
    if (foundOwner) {
      createNotification(store, foundOwner.id, 'Possible owner detected', `A missing report may match your found report ${buildDisplayName(foundCase)}.`, 'match', foundCase.id, `/case-details?caseId=${foundCase.id}&view=matches`);
    }
  }

  pruneUnmatchablePendingMatches(store);
  syncAllCaseStatusesFromMatches(store);
}


export async function upsertPotentialMatchesForCaseAsync(
  store: Store,
  sourceCase: CaseRecord,
  options: { notifyOnNewMatch?: boolean } = {}
) {
  const notifyOnNewMatch = options.notifyOnNewMatch !== false;
  pruneUnmatchablePendingMatches(store);

  if (!isCaseEligibleForAutoMatching(store, sourceCase)) {
    syncAllCaseStatusesFromMatches(store);
    return;
  }

  const candidates = store.cases.filter(
    (item) => isCaseEligibleForAutoMatching(store, item) && item.id !== sourceCase.id && item.type !== sourceCase.type
  );

  for (const candidate of candidates) {
    const [missingCase, foundCase] = sourceCase.type === 'MISSING' ? [sourceCase, candidate] : [candidate, sourceCase];
    const result = await scorePotentialMatchAsync(missingCase, foundCase);
    const existing = store.matches.find((item) => item.caseId === missingCase.id && item.otherCaseId === foundCase.id);

    if (result.score < REVIEW_OR_BETTER_MATCH_THRESHOLD) {
      if (existing && existing.status === 'PENDING') {
        store.matches = store.matches.filter((item) => item.id !== existing.id);
      }
      continue;
    }

    if (existing) {
      if (existing.status === 'REJECTED') continue;
      existing.score = result.score;
      existing.reason = result.reason;
      existing.imageScore = result.imageScore;
      existing.similarity = result.similarity;
      existing.confidence = result.confidence;
      existing.aiPriorityApplied = result.aiPriorityApplied;
      existing.usedOnlineAi = result.usedOnlineAi;
      existing.decision = result.decision;
      existing.manualReview = result.manualReview;
      existing.scoreBreakdown = result.scoreBreakdown;
      continue;
    }

    store.matches.unshift({
      id: createId('match'),
      caseId: missingCase.id,
      otherCaseId: foundCase.id,
      score: result.score,
      reason: result.reason,
      status: 'PENDING',
      createdAt: nowIso(),
      imageScore: result.imageScore,
      similarity: result.similarity,
      confidence: result.confidence,
      aiPriorityApplied: result.aiPriorityApplied,
      usedOnlineAi: result.usedOnlineAi,
      decision: result.decision,
      manualReview: result.manualReview,
      scoreBreakdown: result.scoreBreakdown
    });

    if (!notifyOnNewMatch) {
      continue;
    }

    const missingOwner = store.users.find((user) => user.id === missingCase.ownerUserId);
    const foundOwner = store.users.find((user) => user.id === foundCase.ownerUserId);
    if (missingOwner) {
      createNotification(store, missingOwner.id, 'Possible match detected', `A found report may match ${buildDisplayName(missingCase)}.`, 'match', missingCase.id, `/case-details?caseId=${missingCase.id}&view=matches`);
    }
    if (foundOwner) {
      createNotification(store, foundOwner.id, 'Possible owner detected', `A missing report may match your found report ${buildDisplayName(foundCase)}.`, 'match', foundCase.id, `/case-details?caseId=${foundCase.id}&view=matches`);
    }
  }

  pruneUnmatchablePendingMatches(store);
  syncAllCaseStatusesFromMatches(store);
}

export function upsertPreviewSelectedMatch(
  store: Store,
  input: {
    savedCaseId: string;
    otherCaseId: string;
    score?: number;
    reason?: string;
    imageScore?: number;
    similarity?: number;
    confidence?: number;
    aiPriorityApplied?: boolean;
    usedOnlineAi?: boolean;
    decision?: MatchRecord['decision'];
    manualReview?: boolean;
    scoreBreakdown?: MatchRecord['scoreBreakdown'];
    notifyOnNewMatch?: boolean;
  }
) {
  const savedCase = store.cases.find((item) => item.id === input.savedCaseId && !item.deletedAt);
  const otherCase = store.cases.find((item) => item.id === input.otherCaseId && !item.deletedAt);
  if (!savedCase || !otherCase || savedCase.type === otherCase.type) {
    return undefined;
  }

  const missingCase = savedCase.type === 'MISSING' ? savedCase : otherCase;
  const foundCase = savedCase.type === 'FOUND' ? savedCase : otherCase;
  const normalizedScore = Number.isFinite(Number(input.score)) ? Math.max(REVIEW_OR_BETTER_MATCH_THRESHOLD, Math.min(Number(input.score), 0.98)) : REVIEW_OR_BETTER_MATCH_THRESHOLD;
  const decisionInfo = getMatchDecision(normalizedScore);
  const existing = store.matches.find((item) => item.caseId === missingCase.id && item.otherCaseId === foundCase.id);

  if (existing && existing.status === 'REJECTED') {
    return existing;
  }

  const previewReason = parseOptionalString(input.reason) || `AI preview kept this match visible after saving ${foundCase.referenceCode}.`;
  const nextDecision = input.decision || decisionInfo.decision;
  const nextManualReview = typeof input.manualReview === 'boolean' ? input.manualReview : decisionInfo.manualReview;

  if (existing) {
    if (existing.status === 'CONFIRMED') {
      return existing;
    }
    const previousScore = existing.score;
    const nextScore = Math.max(existing.score, normalizedScore);
    existing.score = nextScore;
    existing.reason = existing.reason || previewReason;
    existing.imageScore = existing.imageScore ?? input.imageScore;
    existing.similarity = existing.similarity ?? input.similarity ?? input.imageScore;
    existing.confidence = existing.confidence ?? input.confidence ?? input.similarity ?? input.imageScore ?? existing.score;
    existing.aiPriorityApplied = existing.aiPriorityApplied || input.aiPriorityApplied === true;
    existing.usedOnlineAi = existing.usedOnlineAi || input.usedOnlineAi === true;
    existing.decision = nextScore > previousScore ? nextDecision : existing.decision || nextDecision;
    existing.manualReview = existing.manualReview || nextManualReview;
    existing.scoreBreakdown = existing.scoreBreakdown || input.scoreBreakdown;
    syncAllCaseStatusesFromMatches(store);
    return existing;
  }

  const createdAt = nowIso();
  const created: MatchRecord = {
    id: createId('match'),
    caseId: missingCase.id,
    otherCaseId: foundCase.id,
    score: normalizedScore,
    reason: previewReason,
    status: 'PENDING',
    createdAt,
    imageScore: input.imageScore,
    similarity: input.similarity ?? input.imageScore,
    confidence: input.confidence ?? input.similarity ?? input.imageScore ?? normalizedScore,
    aiPriorityApplied: input.aiPriorityApplied === true,
    usedOnlineAi: input.usedOnlineAi === true,
    decision: nextDecision,
    manualReview: nextManualReview,
    scoreBreakdown: input.scoreBreakdown
  };

  store.matches.unshift(created);
  if (input.notifyOnNewMatch !== false) {
    const missingOwner = store.users.find((user) => user.id === missingCase.ownerUserId);
    const foundOwner = store.users.find((user) => user.id === foundCase.ownerUserId);
    if (missingOwner) {
      createNotification(store, missingOwner.id, 'Possible match detected', `A found report may match ${buildDisplayName(missingCase)}.`, 'match', missingCase.id, `/case-details?caseId=${missingCase.id}&view=matches`);
    }
    if (foundOwner) {
      createNotification(store, foundOwner.id, 'Possible owner detected', `A missing report may match your found report ${buildDisplayName(foundCase)}.`, 'match', foundCase.id, `/case-details?caseId=${foundCase.id}&view=matches`);
    }
  }

  syncAllCaseStatusesFromMatches(store);
  return created;
}

export function getHydratedMatches(store: Store, caseId: string): HydratedMatch[] {
  const matches = store.matches.filter((item) => item.caseId === caseId || item.otherCaseId === caseId);
  const hydrated: HydratedMatch[] = [];

  for (const item of matches) {
    const otherCaseId = item.caseId === caseId ? item.otherCaseId : item.caseId;
    const otherCase = store.cases.find((entry) => entry.id === otherCaseId && !entry.deletedAt);
    if (!otherCase) continue;
    const otherOwner = store.users.find((user) => user.id === otherCase.ownerUserId);
    const conversation = findConversationForCases(store, [caseId, otherCase.id]);
    hydrated.push({
      id: item.id,
      score: item.score,
      reason: item.reason,
      status: item.status,
      otherCaseId: otherCase.id,
      otherCaseReferenceCode: otherCase.referenceCode,
      otherCaseDisplayName: buildDisplayName(otherCase),
      otherCaseType: otherCase.type,
      otherCaseStatus: otherCase.status,
      otherCasePrimaryImage: otherCase.images[0]?.imageUrl,
      otherCaseOwner: toUserPreview(otherOwner),
      otherCaseContactPhone: otherCase.contactPhone || otherOwner?.phone,
      conversationId: conversation?.id,
      confirmationRequestedAt: item.confirmationRequestedAt,
      confirmationRequestedByUserId: item.confirmationRequestedByUserId,
      imageScore: item.imageScore,
      similarity: item.similarity ?? item.imageScore,
      confidence: item.confidence ?? item.similarity ?? item.imageScore ?? item.score,
      aiPriorityApplied: item.aiPriorityApplied,
      usedOnlineAi: item.usedOnlineAi,
      decision: item.decision,
      manualReview: item.manualReview,
      matchedCaseId: otherCase.id,
      matchedReportId: otherCase.id,
      scoreBreakdown: item.scoreBreakdown,
      createdAt: item.createdAt
    });
  }

  return hydrated.sort((left, right) => (left.score < right.score ? 1 : -1));
}

export function hydrateCase(item: CaseRecord, store: Store, includeMatches = false): CaseItem {
  const owner = store.users.find((user) => user.id === item.ownerUserId);
  return {
    ...item,
    displayName: buildDisplayName(item),
    primaryImage: item.images[0]?.imageUrl,
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          avatarUrl: owner.avatarUrl,
          phone: owner.phone,
          username: owner.username,
          dateOfBirth: owner.dateOfBirth
        }
      : undefined,
    matches: includeMatches ? getHydratedMatches(store, item.id) : []
  };
}

export function ensureCanManageCase(item: CaseRecord, user: Pick<PublicUser, 'id' | 'role'>) {
  return item.ownerUserId === user.id || user.role === 'ADMIN';
}

export type QueryCasesInput = {
  ownerUserId?: string;
  type?: CaseType;
  status?: CaseStatus;
  search?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'latest' | 'oldest' | 'best_match' | 'recent_update';
  page?: number;
  limit?: number;
};

export function queryCases(store: Store, input: QueryCasesInput) {
  const page = Math.max(1, input.page || 1);
  const limit = Math.max(1, Math.min(50, input.limit || 12));
  const searchValue = normalizeText(input.search);
  const categoryValue = normalizeText(input.category);
  const fromDate = input.dateFrom ? new Date(input.dateFrom) : undefined;
  const toDate = input.dateTo ? new Date(input.dateTo) : undefined;
  const sort = input.sort || 'latest';

  const filtered = store.cases
    .filter((item) => !item.deletedAt)
    .filter((item) => (input.ownerUserId ? item.ownerUserId === input.ownerUserId : true))
    .filter((item) => (input.type ? item.type === input.type : true))
    .filter((item) => (input.status ? item.status === input.status : true))
    .filter((item) => {
      if (!categoryValue) return true;
      const itemCategory = normalizeText(item.category);
      return itemCategory === categoryValue || categoryFamily(item.category) === categoryValue;
    })
    .filter((item) => {
      const comparisonDate = getComparisonDate(item);
      if (!comparisonDate) return !fromDate && !toDate;
      const parsed = new Date(comparisonDate);
      if (Number.isNaN(parsed.getTime())) return true;
      if (fromDate && parsed < fromDate) return false;
      if (toDate && parsed > toDate) return false;
      return true;
    })
    .filter((item) => {
      if (!searchValue) return true;
      const haystack = [item.referenceCode, item.fullName, item.estimatedName, item.description, item.locationText, item.category, item.clothesColor, item.conditionNotes].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchValue);
    });

  const hydrated = filtered.map((item) => hydrateCase(item, store, true));
  hydrated.sort((left, right) => {
    if (sort === 'oldest') return left.createdAt > right.createdAt ? 1 : -1;
    if (sort === 'recent_update') return left.updatedAt < right.updatedAt ? 1 : -1;
    if (sort === 'best_match') {
      const leftScore = left.matches[0]?.score || 0;
      const rightScore = right.matches[0]?.score || 0;
      if (leftScore !== rightScore) return leftScore < rightScore ? 1 : -1;
    }
    return left.createdAt < right.createdAt ? 1 : -1;
  });

  const total = hydrated.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const items = hydrated.slice(start, start + limit);

  return { items, page, limit, total, totalPages };
}

export type CreateCaseInput = {
  ownerUserId: string;
  type: CaseType;
  status: CaseStatus;
  category?: string;
  fullName?: string;
  estimatedName?: string;
  age?: number;
  gender?: string;
  description?: string;
  clothesColor?: string;
  conditionNotes?: string;
  contactPhone?: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  eventTime?: string;
  lastSeenAt?: string;
  foundAt?: string;
  images?: string[];
  aiAnalysis?: CaseAiAnalysis;
  skipAutoMatch?: boolean;
};

function nextReferenceCode(store: Store) {
  const codes = store.cases
    .map((item) => Number(String(item.referenceCode).replace(/[^0-9]/g, '')))
    .filter((value) => Number.isFinite(value));
  const next = Math.max(2000, ...codes) + 1;
  return `RTN-${next}`;
}

export function createCaseRecord(store: Store, input: CreateCaseInput) {
  const now = nowIso();
  const item: CaseRecord = {
    id: createId('case'),
    referenceCode: nextReferenceCode(store),
    ownerUserId: input.ownerUserId,
    type: input.type,
    status: input.status,
    category: input.category,
    fullName: input.fullName,
    estimatedName: input.estimatedName,
    age: input.age,
    gender: input.gender,
    description: input.description,
    clothesColor: input.clothesColor,
    conditionNotes: input.conditionNotes,
    contactPhone: input.contactPhone,
    locationText: input.locationText,
    latitude: input.latitude,
    longitude: input.longitude,
    eventTime: input.eventTime,
    lastSeenAt: input.lastSeenAt,
    foundAt: input.foundAt,
    createdAt: now,
    updatedAt: now,
    images: (input.images || []).map((imageUrl, index) => ({
      id: createId('img'),
      imageUrl,
      sortOrder: index,
      createdAt: now
    })),
    aiAnalysis: input.aiAnalysis,
    statusHistory: [
      {
        id: createId('history'),
        status: input.status,
        changedByUserId: input.ownerUserId,
        note: 'Case created',
        createdAt: now
      }
    ]
  };

  store.cases.unshift(item);
  createNotification(store, input.ownerUserId, 'Report saved', `${buildDisplayName(item)} was saved as ${item.referenceCode}.`, 'case_created', item.id, `/case-details?caseId=${item.id}`);
  if (!input.skipAutoMatch) {
    upsertPotentialMatchesForCase(store, item);
  }
  return item;
}

export function getUserOwnedCases(store: Store, userId: string) {
  return store.cases
    .filter((item) => item.ownerUserId === userId && !item.deletedAt)
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

export function buildMyStats(store: Store, userId: string) {
  const reports = getUserOwnedCases(store, userId);
  const devices = store.devices.filter((item) => item.ownerUserId === userId && isManagedDeviceType(item.type)).length;
  const profiles = store.identificationProfiles.filter((item) => item.ownerUserId === userId).length;
  return { reports: reports.length, devices, profiles };
}

export function buildDashboardSummary(store: Store, userId: string): DashboardSummaryResponse {
  const ownedCases = getUserOwnedCases(store, userId);
  const stats = {
    totalReports: ownedCases.length,
    missingReports: ownedCases.filter((item) => item.type === 'MISSING').length,
    foundReports: ownedCases.filter((item) => item.type === 'FOUND').length,
    activeReports: ownedCases.filter((item) => item.status === 'ACTIVE' || item.status === 'UNDER_REVIEW').length,
    matchedReports: ownedCases.filter((item) => item.status === 'MATCHED' || item.status === 'RESOLVED' || item.status === 'CLOSED').length,
    resolvedReports: ownedCases.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length,
    devices: store.devices.filter((item) => item.ownerUserId === userId && isManagedDeviceType(item.type)).length,
    profiles: store.identificationProfiles.filter((item) => item.ownerUserId === userId).length,
    unreadNotifications: store.notifications.filter((item) => item.userId === userId && !item.isRead).length
  };
  return { stats, recentCases: ownedCases.slice(0, 5).map((item) => hydrateCase(item, store, true)) };
}

export function buildAdminSummary(store: Store): AdminSummaryResponse {
  const userStats = getAdminUserStats(store);
  const openMatches = store.matches.filter((item) => item.status === 'PENDING').length;
  const confirmedMatches = store.matches.filter((item) => item.status === 'CONFIRMED').length;
  return {
    stats: {
      users: userStats.users,
      currentUsers: userStats.currentUsers,
      activeUsers: userStats.activeUsers,
      deletedUsers: userStats.deletedUsers,
      totalReports: store.cases.filter((item) => !item.deletedAt).length,
      missingReports: store.cases.filter((item) => !item.deletedAt && item.type === 'MISSING').length,
      foundReports: store.cases.filter((item) => !item.deletedAt && item.type === 'FOUND').length,
      openMatches,
      confirmedMatches,
      devices: store.devices.filter((item) => isManagedDeviceType(item.type)).length,
      profiles: store.identificationProfiles.length,
      conversations: store.conversations.length,
      messages: store.conversations.reduce((count, item) => count + item.messages.length, 0)
    },
    recentCases: store.cases
      .filter((item) => !item.deletedAt)
      .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))
      .slice(0, 8)
      .map((item) => hydrateCase(item, store, true))
  };
}

export function getProfileByToken(store: Store, token: string) {
  return store.identificationProfiles.find((item) => item.qrPublicToken === token && item.isActive);
}

export function createIdentificationProfileRecord(
  store: Store,
  input: {
    ownerUserId: string;
    displayName: string;
    age?: number;
    category?: string;
    clothesColor?: string;
    bloodType?: string;
    medicalNotes?: string;
    notes?: string;
    lastLocationText?: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
    emergencyContacts: IdentificationProfile['emergencyContacts'];
  }
) {
  const now = nowIso();
  const profile: IdentificationProfile = {
    id: createId('profile'),
    ownerUserId: input.ownerUserId,
    displayName: input.displayName,
    age: input.age,
    category: input.category,
    clothesColor: input.clothesColor,
    bloodType: input.bloodType,
    medicalNotes: input.medicalNotes,
    notes: input.notes,
    lastLocationText: input.lastLocationText,
    latitude: input.latitude,
    longitude: input.longitude,
    photoUrl: input.photoUrl,
    qrPublicToken: `qr_${randomBytes(6).toString('hex')}`,
    isActive: true,
    emergencyContacts: input.emergencyContacts,
    createdAt: now,
    updatedAt: now
  };
  store.identificationProfiles.unshift(profile);
  createNotification(store, input.ownerUserId, 'Identification profile created', `${profile.displayName}'s profile is ready to share through QR or NFC.`, 'system');
  return profile;
}

export function createOrUpdateDevice(
  store: Store,
  input: {
    ownerUserId: string;
    type: DeviceItem['type'];
    hardwareModel?: DeviceItem['hardwareModel'];
    supportsNfc?: boolean;
    supportsBarcode?: boolean;
    supportsGps?: boolean;
    serialNumber?: string;
    label: string;
    linkedProfileId?: string;
    trackingEnabled?: boolean;
    updateIntervalMinutes?: number;
    latitude?: number;
    longitude?: number;
    lastLocationText?: string;
    hardwareBridge?: DeviceItem['hardwareBridge'];
  }
) {
  const capabilityPreset = capabilitiesFromDevice({
    hardwareModel: input.hardwareModel,
    type: input.type,
    supportsNfc: input.supportsNfc,
    supportsBarcode: input.supportsBarcode,
    supportsGps: input.supportsGps
  });
  const serial = input.serialNumber || `${input.type}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const existing = store.devices.find((item) => item.ownerUserId === input.ownerUserId && item.serialNumber === serial);
  if (existing) {
    existing.label = input.label;
    existing.hardwareModel = capabilityPreset.hardwareModel;
    existing.supportsNfc = capabilityPreset.supportsNfc;
    existing.supportsBarcode = capabilityPreset.supportsBarcode;
    existing.supportsGps = capabilityPreset.supportsGps;
    existing.linkedProfileId = input.linkedProfileId ?? existing.linkedProfileId;
    existing.trackingEnabled = input.trackingEnabled ?? existing.trackingEnabled ?? capabilityPreset.defaultTracking;
    existing.updateIntervalMinutes = input.updateIntervalMinutes ?? existing.updateIntervalMinutes ?? capabilityPreset.defaultIntervalMinutes;
    existing.latitude = input.latitude ?? existing.latitude;
    existing.longitude = input.longitude ?? existing.longitude;
    existing.lastLocationText = input.lastLocationText ?? existing.lastLocationText;
    existing.hardwareBridge = input.hardwareBridge ?? existing.hardwareBridge;
    existing.updatedAt = nowIso();
    return existing;
  }

  const created: DeviceItem = {
    id: createId('device'),
    ownerUserId: input.ownerUserId,
    type: input.type,
    hardwareModel: capabilityPreset.hardwareModel,
    supportsNfc: capabilityPreset.supportsNfc,
    supportsBarcode: capabilityPreset.supportsBarcode,
    supportsGps: capabilityPreset.supportsGps,
    serialNumber: serial,
    label: input.label,
    status: 'ACTIVE',
    batteryLevel: capabilityPreset.supportsGps || input.type === 'GPS' || input.type === 'BLUETOOTH' || input.type === 'WIFI' ? 84 : undefined,
    updateIntervalMinutes: input.updateIntervalMinutes ?? capabilityPreset.defaultIntervalMinutes,
    trackingEnabled: input.trackingEnabled ?? capabilityPreset.defaultTracking,
    linkedProfileId: input.linkedProfileId,
    lastLocationText: input.lastLocationText,
    latitude: input.latitude,
    longitude: input.longitude,
    locationHistory: [],
    hardwareBridge: input.hardwareBridge,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  store.devices.unshift(created);
  return created;
}

export function addDeviceLocation(
  store: Store,
  deviceId: string,
  input: { latitude: number; longitude: number; accuracyMeters?: number; address?: string; source?: string }
) {
  const device = store.devices.find((item) => item.id === deviceId);
  if (!device) {
    return undefined;
  }
  const location: DeviceLocationRecord = {
    id: createId('loc'),
    deviceId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    address: input.address,
    source: input.source,
    createdAt: nowIso()
  };
  device.locationHistory.unshift(location);
  device.latitude = input.latitude;
  device.longitude = input.longitude;
  device.lastLocationText = input.address || device.lastLocationText;
  device.updatedAt = nowIso();
  return location;
}

export function recordProfileScan(
  store: Store,
  input: {
    profileId: string;
    type: ScanEvent['type'];
    rawValue?: string;
    finderName?: string;
    finderPhone?: string;
    latitude?: number;
    longitude?: number;
    locationText?: string;
  }
) {
  const event: ScanEvent = {
    id: createId('scan'),
    profileId: input.profileId,
    type: input.type,
    rawValue: input.rawValue,
    finderName: input.finderName,
    finderPhone: input.finderPhone,
    latitude: input.latitude,
    longitude: input.longitude,
    locationText: input.locationText,
    createdAt: nowIso()
  };
  store.scanEvents.unshift(event);
  return event;
}


export function updateUserProfile(
  store: Store,
  userId: string,
  input: {
    name?: string;
    username?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    avatarUrl?: string;
    currentPassword?: string;
    newPassword?: string;
    preference?: Partial<StoredPreference>;
  }
) {
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const nextEmail = parseOptionalString(input.email);
  if (nextEmail && normalizeEmail(nextEmail) !== user.email) {
    if (!isValidEmail(nextEmail)) {
      throw new Error('INVALID_EMAIL');
    }
    const normalized = normalizeEmail(nextEmail);
    if (store.users.some((entry) => entry.id !== user.id && entry.email === normalized)) {
      throw new Error('EMAIL_TAKEN');
    }
    user.email = normalized;
  }

  const nextUsername = parseOptionalString(input.username);
  if (nextUsername && normalizeUsername(nextUsername) !== user.username) {
    const normalized = normalizeUsername(nextUsername);
    if (!normalized) {
      throw new Error('INVALID_USERNAME');
    }
    if (store.users.some((entry) => entry.id !== user.id && entry.username === normalized)) {
      throw new Error('USERNAME_TAKEN');
    }
    user.username = normalized;
  }

  const nextName = parseOptionalString(input.name);
  if (nextName) {
    user.name = nextName;
  }

  if (input.phone !== undefined) {
    user.phone = normalizePhone(String(input.phone || ''));
  }

  if (input.dateOfBirth !== undefined) {
    user.dateOfBirth = parseOptionalDate(input.dateOfBirth) || parseOptionalString(input.dateOfBirth) || undefined;
  }

  if (input.avatarUrl !== undefined) {
    user.avatarUrl = parseOptionalString(input.avatarUrl);
  }

  if (input.newPassword) {
    if (!input.currentPassword || !verifyPassword(input.currentPassword, user.passwordHash)) {
      throw new Error('INVALID_PASSWORD');
    }
    if (!isStrongPassword(input.newPassword)) {
      throw new Error(getPasswordStrengthMessage(input.newPassword));
    }
    user.passwordHash = hashPassword(input.newPassword);
  }

  if (input.preference && typeof input.preference === 'object') {
    const nextPreference = input.preference;
    if (nextPreference.language !== undefined) {
      user.preference.language = nextPreference.language === 'ar' ? 'ar' : 'en';
    }
    if (typeof nextPreference.darkMode === 'boolean') {
      user.preference.darkMode = nextPreference.darkMode;
    }
    if (typeof nextPreference.notificationsEnabled === 'boolean') {
      user.preference.notificationsEnabled = nextPreference.notificationsEnabled;
    }
    if (Number.isFinite(Number(nextPreference.gpsIntervalMinutes))) {
      user.preference.gpsIntervalMinutes = Math.max(1, Math.min(1440, Math.round(Number(nextPreference.gpsIntervalMinutes))));
    }
    if (typeof nextPreference.showContactToFinder === 'boolean') {
      user.preference.showContactToFinder = nextPreference.showContactToFinder;
    }
    if (typeof nextPreference.hideSensitiveDetails === 'boolean') {
      user.preference.hideSensitiveDetails = nextPreference.hideSensitiveDetails;
    }
    if (typeof nextPreference.allowEmergencyLocation === 'boolean') {
      user.preference.allowEmergencyLocation = nextPreference.allowEmergencyLocation;
    }
    if (typeof nextPreference.enableQr === 'boolean') {
      user.preference.enableQr = nextPreference.enableQr;
    }
    if (typeof nextPreference.enableNfc === 'boolean') {
      user.preference.enableNfc = nextPreference.enableNfc;
    }
    if (typeof nextPreference.enableGps === 'boolean') {
      user.preference.enableGps = nextPreference.enableGps;
    }
    if (typeof nextPreference.enableBluetooth === 'boolean') {
      user.preference.enableBluetooth = nextPreference.enableBluetooth;
    }
    if (typeof nextPreference.enableWifi === 'boolean') {
      user.preference.enableWifi = nextPreference.enableWifi;
    }
    if (typeof nextPreference.matchAlerts === 'boolean') {
      user.preference.matchAlerts = nextPreference.matchAlerts;
    }
    if (typeof nextPreference.foundCaseUpdates === 'boolean') {
      user.preference.foundCaseUpdates = nextPreference.foundCaseUpdates;
    }
    if (typeof nextPreference.nearbyAlerts === 'boolean') {
      user.preference.nearbyAlerts = nextPreference.nearbyAlerts;
    }
    if (typeof nextPreference.deviceAlerts === 'boolean') {
      user.preference.deviceAlerts = nextPreference.deviceAlerts;
    }
    if (typeof nextPreference.autoDownloadQr === 'boolean') {
      user.preference.autoDownloadQr = nextPreference.autoDownloadQr;
    }
    if (typeof nextPreference.ownerMessages === 'boolean') {
      user.preference.ownerMessages = nextPreference.ownerMessages;
    }
    if (typeof nextPreference.locationRequests === 'boolean') {
      user.preference.locationRequests = nextPreference.locationRequests;
    }
    if (typeof nextPreference.autoOpenProfile === 'boolean') {
      user.preference.autoOpenProfile = nextPreference.autoOpenProfile;
    }
    if (typeof nextPreference.systemAnalysis === 'boolean') {
      user.preference.systemAnalysis = nextPreference.systemAnalysis;
    }
  }

  user.updatedAt = nowIso();
  return sanitizeUser(user);
}


export function deleteUserAccount(
  store: Store,
  userId: string,
  input: { currentPassword?: string }
) {
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new Error('NOT_FOUND');
  }
  if (!input.currentPassword || !verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new Error('INVALID_PASSWORD');
  }

  const previousEmail = user.email;
  user.status = 'DELETED';
  user.updatedAt = nowIso();
  user.email = `deleted+${user.id}@return.local`;
  user.username = `deleted-${user.id.slice(-6)}`;
  user.phone = undefined;
  user.dateOfBirth = undefined;
  user.avatarUrl = undefined;
  user.preference.notificationsEnabled = false;

  store.sessions = store.sessions.filter((entry) => entry.userId !== userId);
  store.verificationRequests = store.verificationRequests.filter((entry) => entry.userId !== userId && entry.email !== previousEmail);
  store.notifications = store.notifications.filter((entry) => entry.userId !== userId);

  for (const item of store.cases) {
    if (item.ownerUserId === userId && !item.deletedAt) {
      item.deletedAt = nowIso();
      item.status = 'CLOSED';
      item.updatedAt = nowIso();
      item.statusHistory.unshift({
        id: createId('history'),
        status: 'CLOSED',
        note: 'Account deleted',
        createdAt: nowIso()
      });
    }
  }

  for (const device of store.devices) {
    if (device.ownerUserId === userId) {
      device.status = 'INACTIVE';
      device.trackingEnabled = false;
      device.updatedAt = nowIso();
    }
  }

  for (const profile of store.identificationProfiles) {
    if (profile.ownerUserId === userId) {
      profile.isActive = false;
      profile.updatedAt = nowIso();
    }
  }

  for (const conversation of store.conversations) {
    conversation.messages.push({
      id: createId('msg'),
      conversationId: conversation.id,
      senderUserId: userId,
      body: 'This account was deleted. Personal access has been revoked.',
      type: 'SYSTEM',
      createdAt: nowIso()
    });
    conversation.updatedAt = nowIso();
  }

  recordAuditLog(store, {
    event: 'account_deleted',
    severity: 'warning',
    userId,
    details: { softDeletedCases: store.cases.filter((item) => item.ownerUserId === userId).length }
  });

  return true;
}

export function findMatchById(store: Store, matchId: string) {
  return store.matches.find((item) => item.id === matchId);
}

export function requestMatchConfirmation(store: Store, input: { matchId: string; userId: string }) {
  const match = findMatchById(store, input.matchId);
  if (!match) {
    throw new Error('NOT_FOUND');
  }
  const missingCase = store.cases.find((item) => item.id === match.caseId && !item.deletedAt);
  const foundCase = store.cases.find((item) => item.id === match.otherCaseId && !item.deletedAt);
  if (!missingCase || !foundCase) {
    throw new Error('NOT_FOUND');
  }
  if (input.userId !== foundCase.ownerUserId) {
    throw new Error('FOUND_OWNER_ONLY');
  }
  if (match.confirmationRequestedAt) {
    return match;
  }

  match.confirmationRequestedAt = nowIso();
  match.confirmationRequestedByUserId = input.userId;

  const conversation = ensureConversationForMatch(store, { matchId: match.id, requesterUserId: input.userId });
  conversation.messages.unshift({
    id: createId('msg'),
    conversationId: conversation.id,
    senderUserId: input.userId,
    body: 'Final confirmation was requested from the missing report owner.',
    type: 'SYSTEM',
    createdAt: nowIso()
  });
  conversation.updatedAt = nowIso();

  createNotification(
    store,
    missingCase.ownerUserId,
    'Final confirmation requested',
    `A finder requested your final approval for a possible match with ${buildDisplayName(missingCase)}.`,
    'match',
    missingCase.id,
    `/case-details?caseId=${missingCase.id}&view=matches`
  );

  return match;
}

export function confirmMatch(store: Store, input: { matchId: string; userId: string }) {
  const match = findMatchById(store, input.matchId);
  if (!match) {
    throw new Error('NOT_FOUND');
  }
  const leftCase = store.cases.find((item) => item.id === match.caseId && !item.deletedAt);
  const rightCase = store.cases.find((item) => item.id === match.otherCaseId && !item.deletedAt);
  if (!leftCase || !rightCase) {
    throw new Error('NOT_FOUND');
  }
  if (input.userId !== leftCase.ownerUserId) {
    throw new Error('MISSING_OWNER_ONLY');
  }
  if (!match.confirmationRequestedAt) {
    throw new Error('REQUEST_REQUIRED');
  }

  match.status = 'CONFIRMED';
  match.confirmedAt = nowIso();
  match.confirmedByUserId = input.userId;

  for (const other of store.matches) {
    if (other.id === match.id) continue;
    if (other.caseId === match.caseId || other.otherCaseId === match.caseId || other.caseId === match.otherCaseId || other.otherCaseId === match.otherCaseId) {
      if (other.status === 'PENDING') {
        other.status = 'REJECTED';
      }
    }
  }

  const conversation = ensureConversationForMatch(store, { matchId: match.id, requesterUserId: input.userId });
  conversation.messages.unshift({
    id: createId('msg'),
    conversationId: conversation.id,
    senderUserId: input.userId,
    body: 'Final match confirmed by the missing report owner. The missing report was closed and the linked found report remains saved.',
    type: 'SYSTEM',
    createdAt: nowIso()
  });
  conversation.updatedAt = nowIso();

  pruneUnmatchablePendingMatches(store);
  syncAllCaseStatusesFromMatches(store);

  const otherParticipant = conversation.participants.find((participant) => participant.userId !== input.userId);
  if (otherParticipant) {
    createNotification(store, otherParticipant.userId, 'Final match confirmed', 'The missing report owner approved the match. The missing report was closed and the linked found report remains saved.', 'match', leftCase.id, `/case-details?caseId=${leftCase.id}&view=matches`);
  }

  return match;
}

export function rejectMatch(store: Store, input: { matchId: string; userId: string }) {
  const match = findMatchById(store, input.matchId);
  if (!match) {
    throw new Error('NOT_FOUND');
  }
  const leftCase = store.cases.find((item) => item.id === match.caseId && !item.deletedAt);
  const rightCase = store.cases.find((item) => item.id === match.otherCaseId && !item.deletedAt);
  if (!leftCase || !rightCase) {
    throw new Error('NOT_FOUND');
  }
  if (input.userId !== leftCase.ownerUserId) {
    throw new Error('MISSING_OWNER_ONLY');
  }
  if (!match.confirmationRequestedAt) {
    throw new Error('REQUEST_REQUIRED');
  }
  match.status = 'REJECTED';

  const conversation = ensureConversationForMatch(store, { matchId: match.id, requesterUserId: input.userId });
  conversation.messages.unshift({
    id: createId('msg'),
    conversationId: conversation.id,
    senderUserId: input.userId,
    body: 'Final match request declined by the missing report owner.',
    type: 'SYSTEM',
    createdAt: nowIso()
  });
  conversation.updatedAt = nowIso();

  pruneUnmatchablePendingMatches(store);
  syncAllCaseStatusesFromMatches(store);

  const otherParticipant = conversation.participants.find((participant) => participant.userId !== input.userId);
  if (otherParticipant) {
    createNotification(store, otherParticipant.userId, 'Final match declined', 'The missing report owner declined the final confirmation request.', 'match', leftCase.id, `/case-details?caseId=${rightCase.id}&view=matches`);
  }

  return match;
}

function buildConversationTitle(store: Store, caseIds: string[]) {
  const linkedCases = caseIds
    .map((caseId) => store.cases.find((item) => item.id === caseId && !item.deletedAt))
    .filter((item): item is CaseRecord => Boolean(item));
  if (linkedCases.length >= 2) {
    return `${buildDisplayName(linkedCases[0])} ↔ ${buildDisplayName(linkedCases[1])}`;
  }
  if (linkedCases[0]) {
    return `Conversation about ${buildDisplayName(linkedCases[0])}`;
  }
  return 'Match conversation';
}

export function ensureConversationForMatch(
  store: Store,
  input: { matchId: string; requesterUserId: string }
) {
  const match = findMatchById(store, input.matchId);
  if (!match) {
    throw new Error('NOT_FOUND');
  }
  const leftCase = store.cases.find((item) => item.id === match.caseId && !item.deletedAt);
  const rightCase = store.cases.find((item) => item.id === match.otherCaseId && !item.deletedAt);
  if (!leftCase || !rightCase) {
    throw new Error('NOT_FOUND');
  }
  const participantIds = [...new Set([leftCase.ownerUserId, rightCase.ownerUserId])];
  if (!participantIds.includes(input.requesterUserId)) {
    throw new Error('FORBIDDEN');
  }

  const existing = store.conversations.find((conversation) => {
    const caseSet = [...new Set(conversation.caseIds || [])].sort().join(':');
    const participantSet = [...new Set(conversation.participants.map((item) => item.userId))].sort().join(':');
    return caseSet === [...new Set([leftCase.id, rightCase.id])].sort().join(':') && participantSet === [...participantIds].sort().join(':');
  });
  if (existing) {
    return existing;
  }

  const now = nowIso();
  const created: ConversationRecord = {
    id: createId('conv'),
    createdByUserId: input.requesterUserId,
    title: buildConversationTitle(store, [leftCase.id, rightCase.id]),
    relatedCaseId: leftCase.id,
    relatedMatchId: match.id,
    caseIds: [leftCase.id, rightCase.id],
    participants: participantIds.map((userId) => ({
      id: createId('participant'),
      conversationId: '',
      userId,
      joinedAt: now
    })),
    messages: [],
    createdAt: now,
    updatedAt: now
  };
  created.participants = created.participants.map((participant) => ({ ...participant, conversationId: created.id }));
  created.messages.unshift({
    id: createId('msg'),
    conversationId: created.id,
    senderUserId: input.requesterUserId,
    body: 'Private conversation started for this potential match.',
    type: 'SYSTEM',
    createdAt: now
  });
  store.conversations.unshift(created);
  return created;
}

function hydrateConversationMessage(store: Store, message: ConversationMessage, currentUserId?: string): ConversationMessageItem {
  const sender = store.users.find((item) => item.id === message.senderUserId);
  return {
    ...message,
    sender: toUserPreview(sender),
    isMine: currentUserId ? message.senderUserId === currentUserId : undefined
  };
}

function hydrateConversationSummary(store: Store, conversation: ConversationRecord, currentUserId: string): ConversationSummary {
  const participants = conversation.participants
    .map((participant) => store.users.find((user) => user.id === participant.userId))
    .filter((user): user is StoredUser => Boolean(user))
    .map((user) => toUserPreview(user))
    .filter((user): user is PublicUserPreview => Boolean(user));
  const lastMessage = [...conversation.messages]
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))[0];
  return {
    id: conversation.id,
    title: conversation.title || buildConversationTitle(store, conversation.caseIds || []),
    relatedCaseId: conversation.relatedCaseId,
    relatedMatchId: conversation.relatedMatchId,
    caseIds: conversation.caseIds,
    participants,
    lastMessage: lastMessage ? hydrateConversationMessage(store, lastMessage, currentUserId) : undefined,
    unreadCount: 0,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export function listConversationSummariesForUser(store: Store, userId: string) {
  return store.conversations
    .filter((conversation) => conversation.participants.some((participant) => participant.userId === userId))
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))
    .map((conversation) => hydrateConversationSummary(store, conversation, userId));
}

export function getConversationDetailForUser(store: Store, conversationId: string, userId: string): ConversationDetail {
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    throw new Error('NOT_FOUND');
  }
  if (!conversation.participants.some((participant) => participant.userId === userId)) {
    throw new Error('FORBIDDEN');
  }
  const summary = hydrateConversationSummary(store, conversation, userId);
  return {
    ...summary,
    messages: [...conversation.messages]
      .sort((left, right) => (left.createdAt > right.createdAt ? 1 : -1))
      .map((message) => hydrateConversationMessage(store, message, userId))
  };
}

export function addConversationMessage(
  store: Store,
  input: { conversationId: string; senderUserId: string; body: string }
) {
  const conversation = store.conversations.find((item) => item.id === input.conversationId);
  if (!conversation) {
    throw new Error('NOT_FOUND');
  }
  if (!conversation.participants.some((participant) => participant.userId === input.senderUserId)) {
    throw new Error('FORBIDDEN');
  }
  const body = parseOptionalString(input.body);
  if (!body) {
    throw new Error('EMPTY_MESSAGE');
  }
  const message: ConversationMessage = {
    id: createId('msg'),
    conversationId: conversation.id,
    senderUserId: input.senderUserId,
    body,
    type: 'TEXT',
    createdAt: nowIso()
  };
  conversation.messages.push(message);
  conversation.updatedAt = nowIso();

  for (const participant of conversation.participants) {
    if (participant.userId !== input.senderUserId) {
      createNotification(store, participant.userId, 'New chat message', body, 'message', conversation.relatedCaseId, `/chat?conversationId=${conversation.id}`);
    }
  }

  return hydrateConversationMessage(store, message, input.senderUserId);
}
