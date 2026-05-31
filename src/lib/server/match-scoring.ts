import { compareAiVisualFeatures } from '@/lib/visual-ai';
import { ACCEPTED_MATCH_THRESHOLD, compareImageSetsWithKairos, getMatchDecision, MANUAL_REVIEW_THRESHOLD } from '@/lib/server/kairos-face';

export interface ScorableCase {
  id?: string;
  category?: string | null;
  fullName?: string | null;
  estimatedName?: string | null;
  age?: number | null;
  gender?: string | null;
  description?: string | null;
  clothesColor?: string | null;
  conditionNotes?: string | null;
  contactPhone?: string | null;
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  eventTime?: string | Date | null;
  lastSeenAt?: string | Date | null;
  foundAt?: string | Date | null;
  createdAt?: string | Date | null;
  images: Array<{ imageUrl: string }>;
  aiAnalysis?: {
    features?: any;
    summary?: string;
  } | null;
}

export function normalizeText(value?: string | null) {
  return value
    ?.toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '';
}

export function tokenize(value?: string | null) {
  return normalizeText(value)
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

export function overlapRatio(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  return overlap / Math.max(leftSet.size, rightSet.size, 1);
}

export function categoryFamily(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  if (['child', 'elderly', 'adult male', 'adult female', 'person', 'people', 'man', 'woman'].includes(normalized)) return 'person';
  if (['pet', 'dog', 'cat', 'animal'].includes(normalized)) return 'pet';
  if (['car', 'motorcycle', 'bicycle', 'vehicle'].includes(normalized)) return 'vehicle';
  if (['document', 'bag', 'phone', 'wallet', 'keys', 'item', 'belonging'].includes(normalized)) return 'item';
  return normalized;
}

export function distanceKm(left: ScorableCase, right: ScorableCase) {
  if (
    left.latitude === undefined || left.latitude === null ||
    left.longitude === undefined || left.longitude === null ||
    right.latitude === undefined || right.latitude === null ||
    right.longitude === undefined || right.longitude === null
  ) {
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

export function getComparisonDate(item: ScorableCase) {
  return item.lastSeenAt || item.foundAt || item.eventTime || item.createdAt;
}

export function buildDisplayName(item: ScorableCase) {
  return item.fullName || item.estimatedName || 'Unknown case';
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

export function assessPersonMetadataStrength(input: PersonMetadataStrengthInput) {
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

export type ComparisonSignals = {
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

export function buildComparisonSignals(left: ScorableCase, right: ScorableCase): ComparisonSignals {
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
  const ageGap = left.age !== undefined && left.age !== null && right.age !== undefined && right.age !== null ? Math.abs(left.age - right.age) : undefined;
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

export function finalizeHybridMatchResult(
  left: ScorableCase,
  right: ScorableCase,
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

export function scorePotentialMatch(left: ScorableCase, right: ScorableCase) {
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

async function scorePotentialMatchWithOnlineFaceAi(left: ScorableCase, right: ScorableCase) {
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
      { ...left, aiAnalysis: undefined, images: [] } as ScorableCase,
      { ...right, aiAnalysis: undefined, images: [] } as ScorableCase,
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

export async function scorePotentialMatchAsync(left: ScorableCase, right: ScorableCase) {
  const onlineResult = await scorePotentialMatchWithOnlineFaceAi(left, right);
  if (onlineResult) {
    return onlineResult;
  }
  return scorePotentialMatch(left, right);
}
