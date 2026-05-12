import type {
  AuthResponse,
  CaseItem,
  CasesResponse,
  ConversationDetail,
  ConversationSummary,
  AdminSummaryResponse,
  DashboardSummaryResponse,
  IdentificationProfile,
  NotificationItem,
  PublicUser,
  RegisterCodeResponse
} from '@/lib/shared-types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function shouldRetry(method: string, status?: number) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (status === undefined) return true;
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

async function request<T>(input: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const method = String(init.method || 'GET').toUpperCase();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        cache: 'no-store',
        credentials: 'include',
        headers: {
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {})
        }
      });

      const text = await response.text();
      const payload = text ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      })() : {};

      if (!response.ok) {
        if (attempt < 2 && shouldRetry(method, response.status)) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }
        const message = typeof (payload as any).error === 'string'
          ? (payload as any).error
          : typeof (payload as any).message === 'string'
            ? (payload as any).message
            : typeof (payload as any).raw === 'string' && (payload as any).raw.trim()
              ? (payload as any).raw
              : 'Request failed.';
        throw new ApiError(message, response.status);
      }

      return payload as T;
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError) {
        throw error;
      }
      if (attempt < 2 && shouldRetry(method)) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        continue;
      }
    }
  }

  throw new ApiError(lastError instanceof Error ? lastError.message : 'Request failed.', 0);
}


function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export type MeResponse = {
  user: PublicUser;
  settings: PublicUser['preference'];
  stats: {
    reports: number;
    devices: number;
    profiles: number;
  };
};

export const api = {
  login: (payload: { emailOrUsername: string; password: string; rememberMe?: boolean }) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  register: (payload: {
    name: string;
    username?: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
    avatarUrl?: string;
    password: string;
    rememberMe?: boolean;
  }) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  requestRegisterCode: (payload: {
    name: string;
    username?: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
    avatarUrl?: string;
    password: string;
    rememberMe?: boolean;
  }) =>
    request<RegisterCodeResponse>('/api/auth/register/request-code', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  verifyRegisterCode: (payload: { email: string; code: string; rememberMe?: boolean }) =>
    request<AuthResponse>('/api/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  requestPasswordResetCode: (payload: { email: string }) =>
    request<RegisterCodeResponse>('/api/auth/password/request-code', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  resetPassword: (payload: { email: string; code: string; password: string }) =>
    request<{ success: boolean; message: string }>('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => request<MeResponse>('/api/me'),

  updateMe: (payload: {
    name?: string;
    username?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    avatarUrl?: string;
    currentPassword?: string;
    newPassword?: string;
    preference?: Partial<PublicUser['preference']>;
  }) =>
    request<MeResponse>('/api/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),


  deleteMe: (payload: { currentPassword: string }) =>
    request<{ success: boolean }>('/api/me', {
      method: 'DELETE',
      body: JSON.stringify(payload)
    }),

  dashboardSummary: () => request<DashboardSummaryResponse>('/api/dashboard/summary'),

  adminSummary: () => request<AdminSummaryResponse>('/api/admin/summary'),

  myReports: (params: { type?: string; status?: string; page?: number; limit?: number; category?: string; dateFrom?: string; dateTo?: string; sort?: string } = {}) =>
    request<CasesResponse>(`/api/me/reports${toQuery(params)}`),

  cases: (params: { type?: string; status?: string; owner?: string; page?: number; limit?: number; search?: string; category?: string; dateFrom?: string; dateTo?: string; sort?: string } = {}) =>
    request<CasesResponse>(`/api/cases${toQuery(params)}`),

  createMissing: (payload: Record<string, unknown>) =>
    request<{ item: CaseItem }>('/api/cases/missing', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  createFound: (payload: Record<string, unknown>) =>
    request<{ item: CaseItem }>('/api/cases/found', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  previewAiMatch: (payload: Record<string, unknown>) =>
    request<{
      matches: Array<{
        score: number;
        reason: string;
        imageScore?: number;
        similarity?: number;
        confidence?: number;
        aiPriorityApplied?: boolean;
        usedAiPhotoPriority?: boolean;
        usedOnlineAi?: boolean;
        decision?: 'Accepted Match' | 'Manual Review' | 'No Match';
        manualReview?: boolean;
        matchedCaseId?: string;
        matchedReportId?: string;
        scoreBreakdown?: Record<string, number | undefined>;
        otherCase: CaseItem;
      }>;
      bestMatch?: {
        score: number;
        reason: string;
        imageScore?: number;
        similarity?: number;
        confidence?: number;
        aiPriorityApplied?: boolean;
        usedAiPhotoPriority?: boolean;
        usedOnlineAi?: boolean;
        decision?: 'Accepted Match' | 'Manual Review' | 'No Match';
        manualReview?: boolean;
        matchedCaseId?: string;
        matchedReportId?: string;
        scoreBreakdown?: Record<string, number | undefined>;
        otherCase: CaseItem;
      } | null;
      usedAiPhotoPriority: boolean;
      usedOnlineAi?: boolean;
      minimumAcceptedScore: number;
      minimumAcceptedImageScore: number;
      minimumManualReviewScore?: number;
    }>('/api/ai/preview-match', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getCase: (caseId: string) => request<{ item: CaseItem }>(`/api/cases/${caseId}`),

  updateCase: (caseId: string, payload: Record<string, unknown>) =>
    request<{ item: CaseItem }>(`/api/cases/${caseId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  deleteCase: (caseId: string) =>
    request<{ success: boolean; caseId: string }>(`/api/cases/${caseId}`, {
      method: 'DELETE'
    }),

  confirmMatch: (matchId: string) =>
    request<{ success: boolean; matchId: string }>(`/api/matches/${matchId}/confirm`, {
      method: 'POST'
    }),

  requestMatchConfirmation: (matchId: string) =>
    request<{ success: boolean; matchId: string }>(`/api/matches/${matchId}/request-confirm`, {
      method: 'POST'
    }),

  rejectMatch: (matchId: string) =>
    request<{ success: boolean; matchId: string }>(`/api/matches/${matchId}/reject`, {
      method: 'POST'
    }),

  notifications: () => request<{ items: NotificationItem[] }>('/api/notifications'),

  markAllNotificationsRead: () =>
    request<{ success: boolean; count: number }>('/api/notifications/read-all', {
      method: 'POST'
    }),

  markNotificationRead: (notificationId: string) =>
    request<{ item: NotificationItem }>(`/api/notifications/${notificationId}/read`, {
      method: 'POST'
    }),

  devices: () => request<{ items: any[] }>('/api/devices'),

  createDevice: (payload: Record<string, unknown>) =>
    request<{ item: any }>('/api/devices', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateDevice: (deviceId: string, payload: Record<string, unknown>) =>
    request<{ item: any }>(`/api/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  deleteDevice: (deviceId: string) =>
    request<{ success: boolean; deviceId: string }>(`/api/devices/${deviceId}`, {
      method: 'DELETE'
    }),

  identificationProfiles: () => request<{ items: IdentificationProfile[] }>('/api/identification-profiles'),

  createIdentificationProfile: (payload: Record<string, unknown>) =>
    request<{ item: IdentificationProfile }>('/api/identification-profiles', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  createQrForProfile: (profileId: string) =>
    request<{ token: string; publicUrl: string }>(`/api/identification-profiles/${profileId}/qr`, {
      method: 'POST'
    }),

  linkNfcTag: (profileId: string, payload: { nfcTagUid?: string; hardwareModel?: 'SMART_TAG_LITE' | 'SMART_TAG_PRO' }) =>
    request<{ success: boolean; nfcTagUid: string; hardwareModel?: 'SMART_TAG_LITE' | 'SMART_TAG_PRO'; capabilities?: { supportsNfc: boolean; supportsBarcode: boolean; supportsGps: boolean }; hardware?: { ready: boolean; endpointPath: string; endpointUrl: string; telemetryPath?: string; telemetryUrl?: string; headerName: string; deviceToken: string; tokenPreview: string; publicUrl: string; deviceId?: string; serialNumber?: string; barcodeReady?: boolean } }>(`/api/identification-profiles/${profileId}/nfc`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  lookupPublicProfile: (token: string) => request<{ item: IdentificationProfile }>(`/api/public/identify/${token}`),

  scanQr: (payload: { token?: string; rawValue?: string; finderName?: string; finderPhone?: string; latitude?: number; longitude?: number; locationText?: string }) =>
    request<{ item: IdentificationProfile }>('/api/scans/qr', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  conversations: () => request<{ items: ConversationSummary[] }>('/api/conversations'),

  startConversationForMatch: (payload: { matchId: string }) =>
    request<{ item: ConversationDetail }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getConversation: (conversationId: string) =>
    request<{ item: ConversationDetail }>(`/api/conversations/${conversationId}`),

  sendConversationMessage: (conversationId: string, payload: { body: string }) =>
    request<{ item: any }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};
