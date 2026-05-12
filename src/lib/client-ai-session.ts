export const AI_IMAGE_KEY = 'pending_ai_image';
export const AI_IMAGE_REQUEST_KEY = 'pending_ai_image_request';
export const AI_MATCHES_KEY = 'pending_ai_preview_matches';
export const AI_SUMMARY_KEY = 'pending_ai_preview_summary';
const AI_IMAGE_RECORD_KEY = 'pending_ai_image_record';
const AI_MATCHES_RECORD_KEY = 'pending_ai_preview_matches_record';

export type PendingAiSummary = {
  usedAiPhotoPriority?: boolean;
  aiAnalysis?: unknown;
  materializedCaseId?: string;
  materializedMatchId?: string;
  materializedConversationId?: string;
  materializedReferenceCode?: string;
  confirmationRequested?: boolean;
};

type PendingAiImageRecord = {
  requestId: string;
  imageDataUrl: string;
  savedAt: number;
};

type PendingAiMatchesRecord<T = unknown> = {
  requestId?: string;
  matches: T[];
  summary?: PendingAiSummary;
  savedAt: number;
};

let memoryImageRecord: PendingAiImageRecord | null = null;
let memoryMatchesRecord: PendingAiMatchesRecord | null = null;

function canUseStorage() {
  return typeof window !== 'undefined';
}

function getStorages() {
  if (!canUseStorage()) return [] as Storage[];
  const storages: Storage[] = [];
  if (typeof window.sessionStorage !== 'undefined') storages.push(window.sessionStorage);
  if (typeof window.localStorage !== 'undefined') storages.push(window.localStorage);
  return storages;
}

function readFirst(key: string) {
  for (const storage of getStorages()) {
    try {
      const value = storage.getItem(key);
      if (value) return value;
    } catch {
      // ignore storage access issues on restricted browsers
    }
  }
  return null;
}

function writeAll(key: string, value: string) {
  for (const storage of getStorages()) {
    try {
      storage.setItem(key, value);
    } catch {
      // ignore quota / privacy mode issues; memory fallback still works
    }
  }
}

function removeAll(key: string) {
  for (const storage of getStorages()) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore storage cleanup failures
    }
  }
}

function readImageRecord(requestId?: string) {
  if (memoryImageRecord && (!requestId || memoryImageRecord.requestId === requestId)) {
    return memoryImageRecord;
  }

  const encodedRecord = readFirst(AI_IMAGE_RECORD_KEY);
  if (encodedRecord) {
    try {
      const parsed = JSON.parse(encodedRecord) as PendingAiImageRecord;
      if (!requestId || parsed.requestId === requestId) {
        memoryImageRecord = parsed;
        return parsed;
      }
    } catch {
      // fall through to legacy keys
    }
  }

  const imageDataUrl = readFirst(AI_IMAGE_KEY);
  const storedRequestId = readFirst(AI_IMAGE_REQUEST_KEY) || undefined;
  if (!imageDataUrl) return null;
  if (requestId && storedRequestId && storedRequestId !== requestId) return null;

  const fallbackRecord = {
    requestId: storedRequestId || requestId || 'legacy',
    imageDataUrl,
    savedAt: Date.now()
  } satisfies PendingAiImageRecord;
  memoryImageRecord = fallbackRecord;
  return fallbackRecord;
}

function readMatchesRecord<T>(requestId?: string) {
  if (memoryMatchesRecord && (!requestId || memoryMatchesRecord.requestId === requestId)) {
    return memoryMatchesRecord as PendingAiMatchesRecord<T>;
  }

  const encodedRecord = readFirst(AI_MATCHES_RECORD_KEY);
  if (encodedRecord) {
    try {
      const parsed = JSON.parse(encodedRecord) as PendingAiMatchesRecord<T>;
      if (!requestId || parsed.requestId === requestId) {
        memoryMatchesRecord = parsed;
        return parsed;
      }
    } catch {
      // fall through to legacy keys
    }
  }

  const rawMatches = readFirst(AI_MATCHES_KEY);
  if (!rawMatches) return null;
  try {
    const matches = JSON.parse(rawMatches) as T[];
    const summaryRaw = readFirst(AI_SUMMARY_KEY);
    const fallbackRecord = {
      requestId,
      matches,
      summary: summaryRaw ? (JSON.parse(summaryRaw) as PendingAiSummary) : undefined,
      savedAt: Date.now()
    } satisfies PendingAiMatchesRecord<T>;
    memoryMatchesRecord = fallbackRecord;
    return fallbackRecord;
  } catch {
    return null;
  }
}

export function savePendingAiImage(imageDataUrl: string) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: PendingAiImageRecord = {
    requestId,
    imageDataUrl,
    savedAt: Date.now()
  };

  memoryImageRecord = record;
  writeAll(AI_IMAGE_KEY, imageDataUrl);
  writeAll(AI_IMAGE_REQUEST_KEY, requestId);
  writeAll(AI_IMAGE_RECORD_KEY, JSON.stringify(record));
  return requestId;
}

export function getPendingAiRequestId() {
  return readImageRecord()?.requestId || readFirst(AI_IMAGE_REQUEST_KEY) || null;
}

export function getPendingAiImage(requestId?: string, allowFallback = true) {
  const directMatch = readImageRecord(requestId)?.imageDataUrl ?? null;
  if (directMatch) return directMatch;
  if (requestId && allowFallback) {
    return readImageRecord()?.imageDataUrl ?? null;
  }
  return null;
}

export async function waitForPendingAiImage(requestId?: string, timeoutMs = 5000, intervalMs = 80) {
  const startedAt = Date.now();
  let current = getPendingAiImage(requestId);
  while (!current && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    current = getPendingAiImage(requestId);
  }
  if (!current && requestId) {
    current = getPendingAiImage(undefined, false);
  }
  return current;
}

export function clearPendingAiImage() {
  memoryImageRecord = null;
  removeAll(AI_IMAGE_KEY);
  removeAll(AI_IMAGE_REQUEST_KEY);
  removeAll(AI_IMAGE_RECORD_KEY);
}

export function savePendingAiMatches<T>(matches: T[], summary?: PendingAiSummary, requestId?: string) {
  const record: PendingAiMatchesRecord<T> = {
    requestId,
    matches: matches || [],
    summary,
    savedAt: Date.now()
  };

  memoryMatchesRecord = record;
  writeAll(AI_MATCHES_KEY, JSON.stringify(matches || []));
  if (summary) {
    writeAll(AI_SUMMARY_KEY, JSON.stringify(summary));
  } else {
    removeAll(AI_SUMMARY_KEY);
  }
  writeAll(AI_MATCHES_RECORD_KEY, JSON.stringify(record));
}

export function loadPendingAiSummary(requestId?: string, allowFallback = true) {
  const directSummary = readMatchesRecord<unknown>(requestId)?.summary ?? null;
  if (directSummary) return directSummary;
  if (requestId && allowFallback) {
    return readMatchesRecord<unknown>()?.summary ?? null;
  }
  const rawSummary = readFirst(AI_SUMMARY_KEY);
  if (!rawSummary) return null;
  try {
    return JSON.parse(rawSummary) as PendingAiSummary;
  } catch {
    return null;
  }
}

export function savePendingAiSummary(summary: PendingAiSummary, requestId?: string) {
  const currentRecord = readMatchesRecord<unknown>(requestId) || {
    requestId,
    matches: [],
    savedAt: Date.now()
  };

  const nextRecord: PendingAiMatchesRecord<unknown> = {
    requestId: requestId || currentRecord.requestId,
    matches: currentRecord.matches || [],
    summary,
    savedAt: Date.now()
  };

  memoryMatchesRecord = nextRecord;
  writeAll(AI_SUMMARY_KEY, JSON.stringify(summary));
  writeAll(AI_MATCHES_RECORD_KEY, JSON.stringify(nextRecord));
}

export function loadPendingAiMatches<T>(requestId?: string, allowFallback = true) {
  const directMatches = readMatchesRecord<T>(requestId)?.matches ?? ([] as T[]);
  if (directMatches.length > 0) return directMatches;
  if (requestId && allowFallback) {
    return readMatchesRecord<T>()?.matches ?? ([] as T[]);
  }
  return directMatches;
}

export async function waitForPendingAiMatches<T>(requestId?: string, timeoutMs = 3500, intervalMs = 80) {
  const startedAt = Date.now();
  let current = loadPendingAiMatches<T>(requestId);
  while (!current.length && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    current = loadPendingAiMatches<T>(requestId);
  }
  if (!current.length && requestId) {
    current = loadPendingAiMatches<T>(undefined, false);
  }
  return current;
}

export function clearPendingAiMatches() {
  memoryMatchesRecord = null;
  removeAll(AI_MATCHES_KEY);
  removeAll(AI_SUMMARY_KEY);
  removeAll(AI_MATCHES_RECORD_KEY);
}
