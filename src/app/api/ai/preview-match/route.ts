import {
  createId,
  hydrateCase,
  inferCategory,
  isCaseEligibleForAutoMatching,
  parseOptionalDate,
  parseOptionalNumber,
  parseOptionalString,
  readStore,
  scorePotentialMatchAsync
} from '@/lib/server/store';
import { ACCEPTED_MATCH_THRESHOLD, isKairosConfigured, MANUAL_REVIEW_THRESHOLD, validateSingleFaceImage } from '@/lib/server/kairos-face';
import { apiError, apiJson, enforceRateLimit, readJsonBody, requireSameOrigin, requireUser } from '@/lib/server/http';
import type { CaseAiAnalysis, CaseRecord, CaseType } from '@/lib/shared-types';

export const runtime = 'nodejs';

const MIN_PREVIEW_MATCH_SCORE = ACCEPTED_MATCH_THRESHOLD;
const MIN_PREVIEW_IMAGE_SCORE = MANUAL_REVIEW_THRESHOLD;

function buildPreviewCase(body: Record<string, unknown>, ownerUserId: string, type: CaseType): CaseRecord {
  const images = Array.isArray(body.images)
    ? body.images.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 4)
    : typeof body.photo === 'string' && body.photo.trim()
      ? [body.photo.trim()]
      : [];

  return {
    id: createId('preview_case'),
    referenceCode: 'PREVIEW-AI',
    ownerUserId,
    type,
    status: type === 'FOUND' ? 'UNDER_REVIEW' : 'ACTIVE',
    category: inferCategory(parseOptionalString(body.category) || parseOptionalString(body.type)),
    fullName: type === 'MISSING' ? parseOptionalString(body.fullName ?? body.name) : undefined,
    estimatedName: type === 'FOUND' ? parseOptionalString(body.estimatedName ?? body.name) : undefined,
    age: parseOptionalNumber(body.age),
    gender: parseOptionalString(body.gender),
    description: parseOptionalString(body.description),
    clothesColor: parseOptionalString(body.clothesColor),
    conditionNotes: parseOptionalString(body.conditionNotes),
    contactPhone: parseOptionalString(body.contactPhone),
    locationText: parseOptionalString(body.locationText ?? body.location),
    latitude: parseOptionalNumber(body.latitude),
    longitude: parseOptionalNumber(body.longitude),
    eventTime: parseOptionalDate(body.eventTime ?? body.dateTime ?? body.lastSeenAt ?? body.foundAt),
    lastSeenAt: type === 'MISSING' ? parseOptionalDate(body.lastSeenAt ?? body.dateTime) : undefined,
    foundAt: type === 'FOUND' ? parseOptionalDate(body.foundAt ?? body.dateTime) : undefined,
    images: images.map((imageUrl, index) => ({
      id: createId('img'),
      imageUrl,
      sortOrder: index,
      createdAt: new Date().toISOString()
    })),
    statusHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiAnalysis: typeof body.aiAnalysis === 'object' && body.aiAnalysis ? (body.aiAnalysis as CaseAiAnalysis) : undefined
  };
}

export async function POST(request: Request) {
  const sameOriginError = requireSameOrigin(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireUser();
  if (auth.response || !auth.user) {
    return auth.response!;
  }

  const rateError = enforceRateLimit({
    request,
    user: auth.user,
    label: 'ai-preview',
    limit: 20,
    windowMs: 60 * 1000
  });
  if (rateError) {
    return rateError;
  }

  const body = await readJsonBody(request);
  const caseType = body.caseType === 'FOUND' ? 'FOUND' : 'MISSING';
  const previewCase = buildPreviewCase(body as Record<string, unknown>, auth.user.id, caseType);
  const sourceImage = previewCase.images[0]?.imageUrl;

  if (!sourceImage) {
    return apiError(400, 'Please upload a photo first.');
  }

  if (isKairosConfigured()) {
    const faceValidation = await validateSingleFaceImage(sourceImage);
    if (
      !faceValidation.ok
      && faceValidation.usedOnlineAi
      && (faceValidation.issue === 'NO_FACE_DETECTED' || faceValidation.issue === 'MULTIPLE_FACES' || faceValidation.issue === 'UNSUPPORTED_IMAGE')
    ) {
      return apiError(422, faceValidation.message, {
        decision: 'No Match',
        manualReview: false,
        usedOnlineAi: true
      });
    }
  }

  const store = await readStore();
  const matches: Array<{
    score: number;
    reason: string;
    imageScore?: number;
    similarity?: number;
    confidence?: number;
    aiPriorityApplied?: boolean;
    usedAiPhotoPriority?: boolean;
    usedOnlineAi?: boolean;
    decision?: string;
    manualReview?: boolean;
    matchedCaseId?: string;
    matchedReportId?: string;
    scoreBreakdown?: Record<string, number | undefined>;
    otherCase: ReturnType<typeof hydrateCase>;
  }> = [];

  for (const candidate of store.cases.filter((item) => isCaseEligibleForAutoMatching(store, item) && item.type !== previewCase.type)) {
    const [missingCase, foundCase] = previewCase.type === 'MISSING' ? [previewCase, candidate] : [candidate, previewCase];
    const result = await scorePotentialMatchAsync(missingCase, foundCase);
    if (result.score < MANUAL_REVIEW_THRESHOLD) {
      continue;
    }
    if (result.usedOnlineAi && result.imageScore !== undefined && result.imageScore < MANUAL_REVIEW_THRESHOLD) {
      continue;
    }

    matches.push({
      score: result.score,
      reason: result.reason,
      imageScore: result.imageScore,
      similarity: result.similarity,
      confidence: result.confidence,
      aiPriorityApplied: result.aiPriorityApplied,
      usedAiPhotoPriority: result.aiPriorityApplied,
      usedOnlineAi: result.usedOnlineAi,
      decision: result.decision,
      manualReview: result.manualReview,
      matchedCaseId: candidate.id,
      matchedReportId: candidate.id,
      scoreBreakdown: result.scoreBreakdown,
      otherCase: hydrateCase(candidate, store, false)
    });
  }

  matches.sort((left, right) => (left.score < right.score ? 1 : -1));
  const limitedMatches = matches.slice(0, 2);

  return apiJson({
    matches: limitedMatches,
    bestMatch: limitedMatches[0] || null,
    usedAiPhotoPriority: limitedMatches.some((item) => item.usedAiPhotoPriority),
    usedOnlineAi: limitedMatches.some((item) => item.usedOnlineAi),
    minimumAcceptedScore: MIN_PREVIEW_MATCH_SCORE,
    minimumAcceptedImageScore: MIN_PREVIEW_IMAGE_SCORE,
    minimumManualReviewScore: MANUAL_REVIEW_THRESHOLD
  });
}
