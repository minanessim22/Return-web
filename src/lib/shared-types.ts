export type UserRole = 'USER' | 'ADMIN' | 'OPERATOR';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'LOCKED' | 'SUSPENDED' | 'DELETED';
export type CaseType = 'MISSING' | 'FOUND';
export type CaseStatus = 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'MATCHED' | 'RESOLVED' | 'CLOSED';
export type MatchStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type MatchDecision = 'Accepted Match' | 'Manual Review' | 'No Match';
export type DeviceType = 'GPS' | 'QR' | 'NFC' | 'BLUETOOTH' | 'WIFI';
export type DeviceStatus = 'ACTIVE' | 'PAUSED' | 'DISCONNECTED' | 'LOW_BATTERY' | 'INACTIVE';
export type DeviceHardwareModel = 'STANDALONE' | 'SMART_TAG_LITE' | 'SMART_TAG_PRO';
export type VerificationPurpose = 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_EMAIL';

export interface StoredPreference {
  language: 'en' | 'ar';
  darkMode: boolean;
  notificationsEnabled: boolean;
  gpsIntervalMinutes: number;
  showContactToFinder: boolean;
  hideSensitiveDetails: boolean;
  allowEmergencyLocation: boolean;
  enableQr: boolean;
  enableNfc: boolean;
  enableGps: boolean;
  enableBluetooth: boolean;
  enableWifi: boolean;
  matchAlerts: boolean;
  foundCaseUpdates: boolean;
  nearbyAlerts: boolean;
  deviceAlerts: boolean;
  autoDownloadQr: boolean;
  ownerMessages: boolean;
  locationRequests: boolean;
  autoOpenProfile: boolean;
  systemAnalysis: boolean;
}

export interface AiVisualFeatures {
  version: 1 | 2 | 3;
  averageHash: string;
  differenceHash: string;
  structureHash?: string;
  centerAverageHash?: string;
  centerDifferenceHash?: string;
  focusAverageHash?: string;
  focusDifferenceHash?: string;
  focusStructureHash?: string;
  quadrantHashes?: string[];
  gradientHistogram?: number[];
  rowProfile?: number[];
  columnProfile?: number[];
  colorHistogram: number[];
  brightness: number;
  edgeDensity: number;
  centerEdgeDensity?: number;
  aspectRatio: number;
  width: number;
  height: number;
}

export interface CaseAiAnalysis {
  summary: string;
  generatedAt: string;
  features: AiVisualFeatures;
}

export interface MatchScoreBreakdown {
  category: number;
  location: number;
  description: number;
  image?: number;
  metadata?: number;
  final?: number;
}

export interface StoredUser {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  passwordHash: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt?: string;
  lastLoginAt?: string;
  failedLoginCount: number;
  lockedUntil?: string;
  createdAt: string;
  updatedAt: string;
  preference: StoredPreference;
}

export type PublicUser = Omit<StoredUser, 'passwordHash' | 'failedLoginCount' | 'lockedUntil'>;
export type PublicUserPreview = Pick<PublicUser, 'id' | 'name' | 'email' | 'avatarUrl' | 'phone' | 'username' | 'dateOfBirth'>;

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  csrfToken?: string;
  rememberMe: boolean;
  userAgent?: string;
  ipHash?: string;
  expiresAt: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface VerificationRequest {
  id: string;
  purpose: VerificationPurpose;
  email: string;
  userId?: string;
  codeHash: string;
  attemptsLeft: number;
  expiresAt: string;
  consumedAt?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  event: string;
  severity: 'info' | 'warning' | 'error';
  userId?: string;
  ipHash?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface CaseImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
}

export interface CaseStatusHistoryEntry {
  id: string;
  status: CaseStatus;
  changedByUserId?: string;
  note?: string;
  createdAt: string;
}

export interface CaseRecord {
  id: string;
  referenceCode: string;
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
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  images: CaseImage[];
  statusHistory: CaseStatusHistoryEntry[];
  aiAnalysis?: CaseAiAnalysis;
}

export interface MatchRecord {
  id: string;
  caseId: string;
  otherCaseId: string;
  score: number;
  reason: string;
  status: MatchStatus;
  createdAt: string;
  confirmationRequestedAt?: string;
  confirmationRequestedByUserId?: string;
  confirmedAt?: string;
  confirmedByUserId?: string;
  imageScore?: number;
  similarity?: number;
  confidence?: number;
  aiPriorityApplied?: boolean;
  usedOnlineAi?: boolean;
  decision?: MatchDecision;
  manualReview?: boolean;
  scoreBreakdown?: MatchScoreBreakdown;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  relatedCaseId?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface DeviceHardwareBridge {
  ready: boolean;
  protocol: 'HTTP';
  ingressPath: string;
  headerName: string;
  tokenHash?: string;
  tokenPreview?: string;
  tokenIssuedAt?: string;
  lastSeenAt?: string;
  lastEventAt?: string;
  lastTagUid?: string;
  gpsIngressPath?: string;
  publicUrl?: string;
}

export interface DeviceLocationRecord {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  address?: string;
  source?: string;
  createdAt: string;
}

export interface DeviceItem {
  id: string;
  ownerUserId: string;
  type: DeviceType;
  hardwareModel?: DeviceHardwareModel;
  supportsNfc?: boolean;
  supportsBarcode?: boolean;
  supportsGps?: boolean;
  serialNumber: string;
  label: string;
  status: DeviceStatus;
  batteryLevel?: number;
  updateIntervalMinutes?: number;
  trackingEnabled?: boolean;
  linkedProfileId?: string;
  lastLocationText?: string;
  latitude?: number;
  longitude?: number;
  locationHistory: DeviceLocationRecord[];
  hardwareBridge?: DeviceHardwareBridge;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  id: string;
  contactName: string;
  relation?: string;
  phone: string;
}

export interface IdentificationProfile {
  id: string;
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
  qrPublicToken: string;
  nfcTagUid?: string;
  isActive: boolean;
  emergencyContacts: EmergencyContact[];
  createdAt: string;
  updatedAt: string;
}

export interface ScanEvent {
  id: string;
  profileId: string;
  type: 'QR' | 'NFC';
  rawValue?: string;
  finderName?: string;
  finderPhone?: string;
  latitude?: number;
  longitude?: number;
  locationText?: string;
  createdAt: string;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  type: 'TEXT' | 'SYSTEM';
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  createdByUserId: string;
  title?: string;
  relatedCaseId?: string;
  relatedMatchId?: string;
  caseIds?: string[];
  participants: ConversationParticipant[];
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  users: StoredUser[];
  sessions: SessionRecord[];
  verificationRequests: VerificationRequest[];
  cases: CaseRecord[];
  matches: MatchRecord[];
  notifications: NotificationItem[];
  devices: DeviceItem[];
  identificationProfiles: IdentificationProfile[];
  scanEvents: ScanEvent[];
  auditLogs: AuditLogItem[];
  conversations: ConversationRecord[];
}

export interface HydratedMatch {
  id: string;
  score: number;
  reason: string;
  status: MatchStatus;
  otherCaseId: string;
  otherCaseReferenceCode: string;
  otherCaseDisplayName: string;
  otherCaseType: CaseType;
  otherCaseStatus: CaseStatus;
  otherCasePrimaryImage?: string;
  otherCaseOwner?: PublicUserPreview;
  otherCaseContactPhone?: string;
  conversationId?: string;
  confirmationRequestedAt?: string;
  confirmationRequestedByUserId?: string;
  imageScore?: number;
  similarity?: number;
  confidence?: number;
  aiPriorityApplied?: boolean;
  usedOnlineAi?: boolean;
  decision?: MatchDecision;
  manualReview?: boolean;
  matchedCaseId?: string;
  matchedReportId?: string;
  scoreBreakdown?: MatchScoreBreakdown;
  createdAt: string;
}

export interface CaseItem extends CaseRecord {
  displayName: string;
  primaryImage?: string;
  owner?: PublicUserPreview;
  matches: HydratedMatch[];
}

export interface CasesResponse {
  items: CaseItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}


export interface AdminSummaryResponse {
  stats: {
    users: number;
    currentUsers: number;
    activeUsers: number;
    deletedUsers: number;
    totalReports: number;
    missingReports: number;
    foundReports: number;
    openMatches: number;
    confirmedMatches: number;
    devices: number;
    profiles: number;
    conversations: number;
    messages: number;
  };
  recentCases: CaseItem[];
}

export interface DashboardSummaryResponse {
  stats: {
    totalReports: number;
    missingReports: number;
    foundReports: number;
    activeReports: number;
    matchedReports: number;
    resolvedReports: number;
    devices: number;
    profiles: number;
    unreadNotifications: number;
  };
  recentCases: CaseItem[];
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  expiresAt: string;
}

export interface RegisterCodeResponse {
  success: boolean;
  delivery: 'email' | 'outbox';
  email: string;
  expiresInMinutes: number;
  message: string;
  devHint?: string;
  debugCode?: string;
  providerWarning?: string;
}

export interface ConversationMessageItem extends ConversationMessage {
  sender?: PublicUserPreview;
  isMine?: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  relatedCaseId?: string;
  relatedMatchId?: string;
  caseIds?: string[];
  participants: PublicUserPreview[];
  lastMessage?: ConversationMessageItem;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessageItem[];
}
