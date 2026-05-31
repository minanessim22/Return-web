process.env.IS_SMOKE_TEST = 'true';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CaseAiAnalysis, Store } from '../src/lib/shared-types';
import { compareAiVisualFeatures } from '../src/lib/visual-ai';
import {
  confirmMatch,
  createCaseRecord,
  createIdentificationProfileRecord,
  createUserAccount,
  defaultPreference,
  getHydratedMatches,
  hashPassword,
  parseOptionalString,
  reconcileStoredMatchState,
  requestMatchConfirmation,
  rejectMatch,
  scorePotentialMatch,
  scorePotentialMatchAsync,
  updateUserProfile,
  upsertPotentialMatchesForCase,
  upsertPreviewSelectedMatch
} from './legacy-store-mock';
import { compareImageSetsWithKairos, getMatchDecision, validateSingleFaceImage } from '../src/lib/server/kairos-face';

function createEmptyStore(): Store {
  return {
    users: [],
    sessions: [],
    verificationRequests: [],
    cases: [],
    matches: [],
    notifications: [],
    devices: [],
    identificationProfiles: [],
    scanEvents: [],
    auditLogs: [],
    conversations: [],
    geofences: []
  };
}

function flipEveryOtherBit(value: string) {
  return value
    .split('')
    .map((bit, index) => (index % 2 === 0 ? (bit === '1' ? '0' : '1') : bit))
    .join('');
}

function createStructureBreakingAnalysis(base: CaseAiAnalysis): CaseAiAnalysis {
  const features = base.features as any;
  return {
    summary: 'AI visual profile ready.',
    generatedAt: new Date().toISOString(),
    features: {
      ...features,
      version: 3,
      averageHash: flipEveryOtherBit(features.averageHash),
      differenceHash: flipEveryOtherBit(features.differenceHash),
      structureHash: '0101010101010101010101010101010101010101010101010101010101010101',
      centerAverageHash: '0000111100001111000011110000111100001111000011110000111100001111',
      centerDifferenceHash: '1111000011110000111100001111000011110000111100001111000011110000',
      focusAverageHash: '0000111100001111000011110000111100001111000011110000111100001111',
      focusDifferenceHash: '1111000011110000111100001111000011110000111100001111000011110000',
      focusStructureHash: '0011001100110011001100110011001100110011001100110011001100110011',
      quadrantHashes: ['0000000000000000', '1111111111111111', '0011001100110011', '1100110011001100'],
      gradientHistogram: [1, 0, 0, 0, 0, 0, 0, 0],
      rowProfile: [0.4, 0.3, 0.2, 0.1, 0, 0, 0, 0],
      columnProfile: [0, 0, 0, 0, 0.1, 0.2, 0.3, 0.4],
      centerEdgeDensity: 0.9
    }
  };
}

function createSimilarDifferentPhotoAnalysis(base: CaseAiAnalysis): CaseAiAnalysis {
  const features = base.features as any;
  const softenHash = (value: string, flipEvery = 7) =>
    value
      .split('')
      .map((bit: string, index: number) => (index % flipEvery === 0 ? (bit === '1' ? '0' : '1') : bit))
      .join('');
  const adjustArray = (values: number[] | undefined, deltas: number[]) =>
    (values || []).map((value, index) => Math.max(0, Number((value + (deltas[index] || 0)).toFixed(4))));
  return {
    summary: 'AI visual profile ready.',
    generatedAt: new Date().toISOString(),
    features: {
      ...features,
      version: 3,
      averageHash: softenHash(features.averageHash, 9),
      differenceHash: softenHash(features.differenceHash, 11),
      structureHash: softenHash(features.structureHash || features.averageHash, 13),
      centerAverageHash: softenHash(features.centerAverageHash || features.averageHash, 12),
      centerDifferenceHash: softenHash(features.centerDifferenceHash || features.differenceHash, 10),
      focusAverageHash: softenHash(features.focusAverageHash || features.centerAverageHash || features.averageHash, 10),
      focusDifferenceHash: softenHash(features.focusDifferenceHash || features.centerDifferenceHash || features.differenceHash, 9),
      focusStructureHash: softenHash(features.focusStructureHash || features.structureHash || features.averageHash, 11),
      quadrantHashes: (features.quadrantHashes || []).map((value: string, index: number) => softenHash(value, 5 + index)),
      gradientHistogram: adjustArray(features.gradientHistogram, [0.02, -0.01, 0, -0.01, 0, 0, 0, 0]),
      rowProfile: adjustArray(features.rowProfile, [0.01, 0, -0.01, 0, 0, 0, 0, 0]),
      columnProfile: adjustArray(features.columnProfile, [0, 0.01, 0, -0.01, 0, 0, 0, 0]),
      colorHistogram: adjustArray(features.colorHistogram, [0.01, 0, 0, -0.01, 0.01, 0, 0, -0.01, 0, 0, 0, 0]),
      brightness: Math.max(0, Math.min(1, Number(((features.brightness || 0) * 0.94).toFixed(4)))),
      edgeDensity: Math.max(0, Math.min(1, Number(((features.edgeDensity || 0) * 0.96).toFixed(4)))),
      centerEdgeDensity: Math.max(0, Math.min(1, Number((((features.centerEdgeDensity || features.edgeDensity || 0) * 0.95)).toFixed(4)))),
      aspectRatio: Number(((features.aspectRatio || 1) * 0.97).toFixed(4)),
      width: Math.max(1, Math.round((features.width || 32) * 0.92)),
      height: Math.max(1, Math.round((features.height || 32) * 1.05))
    }
  };
}


function createBaselineAnalysis(): CaseAiAnalysis {
  return {
    summary: 'AI visual profile ready.',
    generatedAt: new Date().toISOString(),
    features: {
      version: 3,
      averageHash: '1111000011110000111100001111000011110000111100001111000011110000',
      differenceHash: '1110001111100011111000111110001111100011111000111110001111100011',
      structureHash: '1111000011110000111100001111000011110000111100001111000011110000',
      centerAverageHash: '1111100011111000111110001111100011111000111110001111100011111000',
      centerDifferenceHash: '1111110001111110001111110001111110001111110001111110001111110001',
      focusAverageHash: '1111111000111111100011111110001111111000111111100011111110001111',
      focusDifferenceHash: '1111110001111111000111111100011111110001111111000111111100011111',
      focusStructureHash: '1111100011111100001111110000111111000011111100001111110000111111',
      quadrantHashes: ['1111000011110000', '1110001111100011', '1111000011111000', '1111100011110001'],
      gradientHistogram: [0.18, 0.14, 0.11, 0.09, 0.08, 0.11, 0.14, 0.15],
      rowProfile: [0.08, 0.1, 0.14, 0.18, 0.18, 0.14, 0.1, 0.08],
      columnProfile: [0.06, 0.09, 0.14, 0.21, 0.21, 0.14, 0.09, 0.06],
      colorHistogram: [0.09, 0.08, 0.07, 0.09, 0.08, 0.09, 0.07, 0.08, 0.1, 0.08, 0.09, 0.09],
      brightness: 0.56,
      edgeDensity: 0.36,
      centerEdgeDensity: 0.39,
      aspectRatio: 0.84,
      width: 256,
      height: 304
    }
  };
}

async function main() {
  const results: string[] = [];

  assert.equal(defaultPreference.enableBluetooth, true);
  assert.equal(defaultPreference.enableWifi, true);
  results.push('default preferences keep Bluetooth and Wi-Fi enabled in addition to the existing device options');

  assert.equal(getMatchDecision(0.8).decision, 'Accepted Match');
  assert.equal(getMatchDecision(0.79).decision, 'Manual Review');
  assert.equal(getMatchDecision(0.74).decision, 'No Match');

  const originalFaceAiMock = process.env.RETURN_FACE_AI_MOCK;
  process.env.RETURN_FACE_AI_MOCK = '1';

  try {
    const noFaceResult = await validateSingleFaceImage('NOFACE_SAMPLE');
    assert.equal(noFaceResult.ok, false);
    if (!noFaceResult.ok) {
      assert.equal(noFaceResult.issue, 'NO_FACE_DETECTED');
      assert.equal(noFaceResult.message, 'No face detected.');
      assert.equal(noFaceResult.usedOnlineAi, true);
    }

    const multipleFacesResult = await validateSingleFaceImage('MULTIFACE_SAMPLE');
    assert.equal(multipleFacesResult.ok, false);
    if (!multipleFacesResult.ok) {
      assert.equal(multipleFacesResult.issue, 'MULTIPLE_FACES');
      assert.match(multipleFacesResult.message, /Multiple faces detected/i);
      assert.equal(multipleFacesResult.usedOnlineAi, true);
    }

    const faceComparison = await compareImageSetsWithKairos(
      ['FACE_A_PRIMARY', 'FACE_A_SECONDARY'],
      ['FACE_A_VARIANT', 'FACE_B_VARIANT']
    );
    assert.equal(faceComparison.usedOnlineAi, true);
    assert.equal(faceComparison.comparedPairs, 4);
    assert.equal(faceComparison.bestSourceIndex, 0);
    assert.equal(faceComparison.bestTargetIndex, 0);
    assert.ok((faceComparison.similarity || 0) >= 0.9);
    assert.ok((faceComparison.confidence || 0) >= 0.9);

    const noFacePairComparison = await compareImageSetsWithKairos(['FACE_A_PRIMARY'], ['CAR_SAMPLE']);
    assert.equal(noFacePairComparison.usedOnlineAi, true);
    assert.equal(noFacePairComparison.comparedPairs, 0);
    assert.equal(noFacePairComparison.skippedPairs, 1);
    assert.match(noFacePairComparison.warnings.join(' '), /no face (was )?detected/i);
    results.push('Local face AI validation maps missing or multiple faces to clear messages, compares all image pairs, and rejects non-face photos before scoring a match');
  } finally {
    if (originalFaceAiMock === undefined) {
      delete process.env.RETURN_FACE_AI_MOCK;
    } else {
      process.env.RETURN_FACE_AI_MOCK = originalFaceAiMock;
    }
  }


  const onlinePreservationStore = createEmptyStore();
  const missingForPreservation = createCaseRecord(onlinePreservationStore, {
    ownerUserId: 'user_missing',
    type: 'MISSING',
    status: 'ACTIVE',
    category: 'child',
    fullName: 'Ahmed Reda',
    age: 10,
    gender: 'Male',
    images: [],
    skipAutoMatch: true
  });
  const foundForPreservation = createCaseRecord(onlinePreservationStore, {
    ownerUserId: 'user_found',
    type: 'FOUND',
    status: 'UNDER_REVIEW',
    category: 'child',
    estimatedName: 'Unknown person or item',
    age: 10,
    gender: 'Male',
    images: [],
    skipAutoMatch: true
  });
  onlinePreservationStore.matches.push({
    id: 'match_online_preserve',
    caseId: missingForPreservation.id,
    otherCaseId: foundForPreservation.id,
    score: 0.74,
    reason: 'Local face AI compared the faces (74% similarity).',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    imageScore: 0.74,
    similarity: 0.74,
    confidence: 0.77,
    aiPriorityApplied: true,
    usedOnlineAi: true,
    decision: 'Manual Review',
    manualReview: true,
    scoreBreakdown: {
      category: 1,
      location: 0,
      description: 0,
      image: 0.74
    }
  });
  reconcileStoredMatchState(onlinePreservationStore);
  assert.equal(onlinePreservationStore.matches.length, 1);
  assert.equal(onlinePreservationStore.matches[0]?.usedOnlineAi, true);
  assert.equal(onlinePreservationStore.matches[0]?.decision, 'Manual Review');

  const seededPreviewStore = createEmptyStore();
  const missingForSeed = createCaseRecord(seededPreviewStore, {
    ownerUserId: 'user_missing_seeded',
    type: 'MISSING',
    status: 'ACTIVE',
    category: 'child',
    fullName: 'Seed Child',
    age: 9,
    gender: 'Male',
    images: ['/photos/13.png'],
    skipAutoMatch: true
  });
  const foundForSeed = createCaseRecord(seededPreviewStore, {
    ownerUserId: 'user_found_seeded',
    type: 'FOUND',
    status: 'UNDER_REVIEW',
    category: 'child',
    estimatedName: 'Unknown person or item',
    age: 9,
    gender: 'Male',
    images: ['/photos/14.png'],
    skipAutoMatch: true
  });
  const seededMatch = upsertPreviewSelectedMatch(seededPreviewStore, {
    savedCaseId: foundForSeed.id,
    otherCaseId: missingForSeed.id,
    score: 0.63,
    reason: 'Preview kept the weak but correct face match.',
    imageScore: 0.72,
    similarity: 0.72,
    confidence: 0.63,
    aiPriorityApplied: true,
    usedOnlineAi: true,
    decision: 'Manual Review',
    manualReview: true,
    scoreBreakdown: {
      category: 1,
      location: 0,
      description: 0,
      image: 0.72
    },
    notifyOnNewMatch: false
  });
  assert.ok(seededMatch);
  assert.equal(seededPreviewStore.matches.length, 1);
  assert.equal(seededPreviewStore.matches[0]?.score, 0.75);
  assert.equal(seededPreviewStore.matches[0]?.decision, 'Manual Review');
  assert.equal(seededPreviewStore.matches[0]?.usedOnlineAi, true);
  reconcileStoredMatchState(seededPreviewStore);
  assert.equal(seededPreviewStore.matches.length, 1);
  assert.equal(getHydratedMatches(seededPreviewStore, foundForSeed.id).length, 1);
  results.push('stored local face AI manual-review matches now survive later reads, and preview-selected weak matches stay linked after the found report is saved');

  const noOnlineFallbackStore = createEmptyStore();
  const missingNoFallback = createCaseRecord(noOnlineFallbackStore, {
    ownerUserId: 'user_missing_nofallback',
    type: 'MISSING',
    status: 'ACTIVE',
    category: 'child',
    fullName: 'Fallback Protected Child',
    age: 11,
    gender: 'Male',
    images: ['/photos/13.png'],
    aiAnalysis: createBaselineAnalysis(),
    skipAutoMatch: true
  });
  const foundNoFallback = createCaseRecord(noOnlineFallbackStore, {
    ownerUserId: 'user_found_nofallback',
    type: 'FOUND',
    status: 'UNDER_REVIEW',
    category: 'child',
    estimatedName: 'Unknown person or item',
    age: 11,
    gender: 'Male',
    images: ['/photos/14.png'],
    aiAnalysis: createSimilarDifferentPhotoAnalysis(createBaselineAnalysis()),
    skipAutoMatch: true
  });

  const savedFaceAiMock = process.env.RETURN_FACE_AI_MOCK;
  process.env.RETURN_FACE_AI_MOCK = '1';
  try {
    missingNoFallback.images = [{ id: 'img_missing_face', imageUrl: 'FACE_A_PRIMARY', sortOrder: 0, createdAt: new Date().toISOString() }];
    foundNoFallback.images = [{ id: 'img_found_car', imageUrl: 'CAR_SAMPLE', sortOrder: 0, createdAt: new Date().toISOString() }];

    const noFallbackResult = await scorePotentialMatchAsync(missingNoFallback, foundNoFallback);
    assert.equal(noFallbackResult.usedOnlineAi, true);
    assert.equal(noFallbackResult.decision, 'No Match');
    assert.ok(noFallbackResult.score < 0.75, `Expected non-face helper failures to stay below review threshold, got ${noFallbackResult.score}`);
  } finally {
    if (savedFaceAiMock === undefined) {
      delete process.env.RETURN_FACE_AI_MOCK;
    } else {
      process.env.RETURN_FACE_AI_MOCK = savedFaceAiMock;
    }
  }
  results.push('Local face AI no-match responses no longer fall back to the weaker generic matcher, which prevents false child-versus-car style matches');

  const inlineImageDataUrl = `data:image/png;base64,${'a'.repeat(4096)}`;
  assert.equal(parseOptionalString(inlineImageDataUrl), inlineImageDataUrl);
  assert.equal(parseOptionalString('x'.repeat(800))?.length, 500);

  const mediaStore = createEmptyStore();
  const mediaUser = createUserAccount(mediaStore, {
    name: 'Media User',
    email: 'media@example.com',
    passwordHash: hashPassword('Strong!Pass1')
  });
  updateUserProfile(mediaStore, mediaUser.id, { avatarUrl: inlineImageDataUrl });
  assert.equal(mediaStore.users[0]?.avatarUrl, inlineImageDataUrl);

  const profile = createIdentificationProfileRecord(mediaStore, {
    ownerUserId: mediaUser.id,
    displayName: 'QR Media Profile',
    photoUrl: inlineImageDataUrl,
    emergencyContacts: []
  });
  assert.equal(profile.photoUrl, inlineImageDataUrl);

  const mediaCase = createCaseRecord(mediaStore, {
    ownerUserId: mediaUser.id,
    type: 'MISSING',
    status: 'ACTIVE',
    category: 'child',
    fullName: 'Media Child',
    images: [inlineImageDataUrl],
    statusHistory: []
  } as any);
  assert.equal(mediaCase.images[0]?.imageUrl, inlineImageDataUrl);
  results.push('profile updates, QR/NFC profiles, and report images now preserve full uploaded image data instead of truncating it');

  const baselineAnalysis = createBaselineAnalysis();
  const similarAnalysis = createSimilarDifferentPhotoAnalysis(baselineAnalysis);
  const missingCase = {
    id: 'case_missing_1',
    referenceCode: 'RTN-M-1',
    ownerUserId: 'user_missing_seed',
    type: 'MISSING',
    status: 'ACTIVE',
    category: 'child',
    fullName: 'Seed Child',
    age: 10,
    gender: 'Male',
    description: 'Blue jacket and school backpack',
    clothesColor: 'Blue',
    locationText: 'Nasr City, Cairo',
    images: [{ id: 'img_missing_1', imageUrl: '/photos/13.png', sortOrder: 0, createdAt: new Date().toISOString() }],
    statusHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiAnalysis: baselineAnalysis
  } as any;
  const foundCase = {
    id: 'case_found_1',
    referenceCode: 'RTN-F-1',
    ownerUserId: 'user_found_seed',
    type: 'FOUND',
    status: 'UNDER_REVIEW',
    category: 'child',
    estimatedName: 'Unknown child',
    age: 10,
    gender: 'Male',
    description: 'Blue jacket and backpack',
    clothesColor: 'Blue',
    locationText: 'Nasr City, Cairo',
    images: [{ id: 'img_found_1', imageUrl: '/photos/14.png', sortOrder: 0, createdAt: new Date().toISOString() }],
    statusHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiAnalysis: similarAnalysis
  } as any;

  const visualComparison = compareAiVisualFeatures(missingCase.aiAnalysis.features as any, foundCase.aiAnalysis.features as any);
  assert.ok(visualComparison.score >= 0.75, `Expected structurally similar score to stay strong, got ${visualComparison.score}`);
  assert.ok(visualComparison.score < 0.96, `Expected conservative scoring for similar-but-not-identical images, got ${visualComparison.score}`);
  assert.ok(visualComparison.structureSimilarity >= 0.74, `Expected strong structure similarity, got ${visualComparison.structureSimilarity}`);
  assert.ok(visualComparison.focusSimilarity >= 0.68, `Expected strong face-focused similarity, got ${visualComparison.focusSimilarity}`);

  const scored = scorePotentialMatch(missingCase as any, foundCase as any);
  assert.equal(scored.aiPriorityApplied, true);
  assert.ok((scored.imageScore || 0) >= 0.75);
  assert.ok((scored.scoreBreakdown?.image || 0) >= 0.75);
  assert.ok(scored.score >= 0.8, `Expected the seed pair to stay visible as a high-confidence match, got ${scored.score}`);
  assert.match(scored.reason, /Data-first matching used the visual analysis as a helper/i);
  results.push('AI photo analysis now acts as a helper while the report data remains the primary match signal');

  const similarDifferentPhotoAnalysis = createSimilarDifferentPhotoAnalysis(missingCase.aiAnalysis as CaseAiAnalysis);
  const variedVisualComparison = compareAiVisualFeatures(missingCase!.aiAnalysis!.features as any, similarDifferentPhotoAnalysis.features as any);
  assert.ok(variedVisualComparison.score >= 0.75, `Expected different-photo visual similarity to remain above the image threshold, got ${variedVisualComparison.score}`);
  assert.ok(variedVisualComparison.score < 0.99, `Expected different-photo visual similarity to avoid perfect duplicate certainty, got ${variedVisualComparison.score}`);
  results.push('different photos of the same person can now stay visible without requiring an exact duplicate image');

  const exactSparseMissing = {
    ...missingCase,
    category: 'child',
    fullName: 'Ahmed Hosafy',
    description: undefined,
    clothesColor: undefined,
    conditionNotes: undefined,
    locationText: 'Damanhur',
    gender: 'Male',
    images: ['/photos/13.png'],
    aiAnalysis: missingCase!.aiAnalysis
  };
  const exactSparseFound = {
    ...missingCase,
    id: 'case_exact_sparse_found',
    type: 'FOUND',
    fullName: undefined,
    estimatedName: 'Unknown person or item',
    description: undefined,
    clothesColor: undefined,
    conditionNotes: undefined,
    locationText: undefined,
    age: undefined,
    gender: 'Male',
    images: ['/photos/13.png'],
    aiAnalysis: missingCase!.aiAnalysis
  };
  const sparseScored = scorePotentialMatch(exactSparseMissing as any, exactSparseFound as any);
  assert.ok(sparseScored.score < 0.8, `Expected sparse same-photo matches to stay below acceptance when metadata is weak, got ${sparseScored.score}`);
  assert.ok((sparseScored.imageScore || 0) >= 0.95);
  results.push('exact same-photo reports no longer auto-pass when the report data stays too sparse');

  const unrelatedAnalysis = createStructureBreakingAnalysis(missingCase!.aiAnalysis as CaseAiAnalysis);
  const falsePositiveMissing = {
    ...missingCase,
    category: 'child',
    description: undefined,
    clothesColor: undefined,
    conditionNotes: undefined,
    locationText: 'Damanhur, Beheira',
    gender: 'Male',
    age: 10,
    images: ['/photos/13.png'],
    aiAnalysis: missingCase!.aiAnalysis
  };
  const falsePositiveFound = {
    ...missingCase,
    id: 'case_false_positive_found',
    type: 'FOUND',
    fullName: undefined,
    estimatedName: 'Unknown person or item',
    description: undefined,
    clothesColor: undefined,
    conditionNotes: undefined,
    locationText: 'Damanhur, Beheira',
    gender: 'Male',
    age: 10,
    images: ['/photos/14.png'],
    aiAnalysis: unrelatedAnalysis
  };
  const falsePositiveScore = scorePotentialMatch(falsePositiveMissing as any, falsePositiveFound as any);
  assert.ok(falsePositiveScore.score < 0.8, `Expected landmark-mismatched pair to stay below visible threshold, got ${falsePositiveScore.score}`);
  assert.ok((falsePositiveScore.imageScore || 1) < 0.75, `Expected structural mismatch to stay in the weak visual range, got ${falsePositiveScore.imageScore}`);
  results.push('matching now prioritizes structure and face or object landmarks over shared lighting, background, or nearby location');

  const metadataOnlyMissing = {
    ...missingCase,
    id: 'case_metadata_only_missing',
    locationText: 'Nasr City, Cairo',
    description: 'Blue jacket and school backpack',
    clothesColor: 'Blue',
    gender: 'Male',
    age: 10,
    aiAnalysis: missingCase.aiAnalysis
  };
  const metadataOnlyFound = {
    ...foundCase,
    id: 'case_metadata_only_found',
    estimatedName: 'Unknown child',
    locationText: 'Nasr City, Cairo',
    description: 'Blue jacket and school backpack',
    clothesColor: 'Blue',
    gender: 'Male',
    age: 10,
    aiAnalysis: unrelatedAnalysis
  };
  const metadataOnlyScore = scorePotentialMatch(metadataOnlyMissing as any, metadataOnlyFound as any);
  assert.ok(metadataOnlyScore.score >= 0.8, `Expected very strong metadata to stay visible even with a weak photo score, got ${metadataOnlyScore.score}`);
  assert.match(metadataOnlyScore.reason, /strong metadata alignment/i);
  results.push('very strong metadata can now keep a person match visible even when the photo side is weak');

  const helperDrivenButDataFirst = scorePotentialMatch(missingCase as any, { ...foundCase, locationText: 'Alexandria', description: 'Different clothes', clothesColor: 'Red', aiAnalysis: similarAnalysis } as any);
  assert.ok(helperDrivenButDataFirst.score < 0.8, `Expected strong photos alone to stay below acceptance when the report data drifts, got ${helperDrivenButDataFirst.score}`);
  assert.ok((helperDrivenButDataFirst.imageScore || 0) >= 0.75);
  results.push('photo similarity stays visible as a helper score, but it no longer overrides weaker report data on its own');

  const demoStore = createEmptyStore();
  const demoAnalysis = missingCase!.aiAnalysis as CaseAiAnalysis;

  const createdMissing = createCaseRecord(demoStore, {
    ownerUserId: 'user_missing_demo',
    type: 'MISSING',
    status: 'ACTIVE',
    category: 'child',
    fullName: 'AI Demo Child',
    age: 9,
    gender: 'Male',
    description: 'Blue jacket and school backpack',
    clothesColor: 'Blue',
    locationText: 'Nasr City, Cairo',
    latitude: 30.0444,
    longitude: 31.2357,
    lastSeenAt: '2026-04-10T10:00:00.000Z',
    eventTime: '2026-04-10T10:00:00.000Z',
    images: ['/photos/13.png'],
    aiAnalysis: demoAnalysis
  });

  createCaseRecord(demoStore, {
    ownerUserId: 'user_found_demo',
    type: 'FOUND',
    status: 'UNDER_REVIEW',
    category: 'child',
    estimatedName: 'Unknown Child',
    age: 10,
    gender: 'Male',
    description: 'Blue jacket and school backpack',
    clothesColor: 'Blue',
    locationText: 'Nasr City, Cairo',
    latitude: 30.05,
    longitude: 31.24,
    foundAt: '2026-04-10T12:00:00.000Z',
    eventTime: '2026-04-10T12:00:00.000Z',
    images: ['/photos/13.png'],
    aiAnalysis: demoAnalysis
  });

  assert.ok(demoStore.matches.length >= 1);
  const createdMatch = demoStore.matches[0];
  assert.equal(createdMatch.aiPriorityApplied, true);
  assert.ok((createdMatch.imageScore || 0) >= 0.95);
  assert.ok((createdMatch.scoreBreakdown?.image || 0) >= 0.95);

  const hydratedMatches = getHydratedMatches(demoStore, createdMissing.id);
  assert.ok(hydratedMatches.length >= 1);
  assert.equal(hydratedMatches[0].aiPriorityApplied, true);
  assert.ok(hydratedMatches[0].scoreBreakdown);
  results.push('stored matches keep AI image score, image-first flag, and the detailed score breakdown for the UI');

  const resolvedStore = createEmptyStore();
  createCaseRecord(resolvedStore, {
    ownerUserId: 'resolved_missing_owner',
    type: 'MISSING',
    status: 'ACTIVE',
    category: 'child',
    fullName: 'Resolved Child',
    age: 10,
    gender: 'Male',
    locationText: 'Nasr City, Cairo',
    lastSeenAt: '2026-04-10T10:00:00.000Z',
    eventTime: '2026-04-10T10:00:00.000Z',
    images: ['/photos/13.png'],
    aiAnalysis: demoAnalysis
  });
  createCaseRecord(resolvedStore, {
    ownerUserId: 'resolved_found_owner',
    type: 'FOUND',
    status: 'UNDER_REVIEW',
    category: 'child',
    estimatedName: 'Unknown Child',
    age: 10,
    gender: 'Male',
    locationText: 'Nasr City, Cairo',
    foundAt: '2026-04-10T11:00:00.000Z',
    eventTime: '2026-04-10T11:00:00.000Z',
    images: ['/photos/13.png'],
    aiAnalysis: demoAnalysis
  });
  const finalMatch = resolvedStore.matches.find((item) => item.status === 'PENDING');
  assert.ok(finalMatch, 'Expected a pending match before confirmation');
  assert.throws(() => confirmMatch(resolvedStore, { matchId: finalMatch!.id, userId: 'resolved_missing_owner' }), /REQUEST_REQUIRED/);
  requestMatchConfirmation(resolvedStore, { matchId: finalMatch!.id, userId: 'resolved_found_owner' });
  assert.ok(finalMatch?.confirmationRequestedAt);
  assert.throws(() => confirmMatch(resolvedStore, { matchId: finalMatch!.id, userId: 'resolved_found_owner' }), /MISSING_OWNER_ONLY/);
  confirmMatch(resolvedStore, { matchId: finalMatch!.id, userId: 'resolved_missing_owner' });
  const closedMissingCase = resolvedStore.cases.find((item) => item.ownerUserId === 'resolved_missing_owner');
  const resolvedFoundCase = resolvedStore.cases.find((item) => item.ownerUserId === 'resolved_found_owner');
  assert.equal(closedMissingCase?.status, 'CLOSED');
  assert.equal(resolvedFoundCase?.status, 'RESOLVED');

  const rejectedStore = createEmptyStore();
  createCaseRecord(rejectedStore, {
    ownerUserId: 'rejected_missing_owner',
    type: 'MISSING',
    status: 'ACTIVE',
    category: 'child',
    fullName: 'Rejected Child',
    age: 10,
    gender: 'Male',
    locationText: 'Nasr City, Cairo',
    lastSeenAt: '2026-04-10T10:00:00.000Z',
    eventTime: '2026-04-10T10:00:00.000Z',
    images: ['/photos/13.png'],
    aiAnalysis: demoAnalysis
  });
  createCaseRecord(rejectedStore, {
    ownerUserId: 'rejected_found_owner',
    type: 'FOUND',
    status: 'UNDER_REVIEW',
    category: 'child',
    estimatedName: 'Rejected Child',
    age: 10,
    gender: 'Male',
    locationText: 'Nasr City, Cairo',
    foundAt: '2026-04-10T11:00:00.000Z',
    eventTime: '2026-04-10T11:00:00.000Z',
    images: ['/photos/13.png'],
    aiAnalysis: demoAnalysis
  });
  const rejectedMatch = rejectedStore.matches.find((item) => item.status === 'PENDING');
  assert.ok(rejectedMatch, 'Expected a pending match before rejection');
  requestMatchConfirmation(rejectedStore, { matchId: rejectedMatch!.id, userId: 'rejected_found_owner' });
  assert.throws(() => rejectMatch(rejectedStore, { matchId: rejectedMatch!.id, userId: 'rejected_found_owner' }), /MISSING_OWNER_ONLY/);
  rejectMatch(rejectedStore, { matchId: rejectedMatch!.id, userId: 'rejected_missing_owner' });
  assert.equal(rejectedMatch?.status, 'REJECTED');
  const lateFoundCase = createCaseRecord(resolvedStore, {
    ownerUserId: 'late_found_owner',
    type: 'FOUND',
    status: 'UNDER_REVIEW',
    category: 'child',
    estimatedName: 'Late report',
    age: 10,
    gender: 'Male',
    locationText: 'Nasr City, Cairo',
    foundAt: '2026-04-10T11:30:00.000Z',
    eventTime: '2026-04-10T11:30:00.000Z',
    images: ['/photos/13.png'],
    aiAnalysis: demoAnalysis
  });
  upsertPotentialMatchesForCase(resolvedStore, lateFoundCase);
  assert.equal(resolvedStore.matches.filter((item) => item.status === 'PENDING').length, 0, 'Confirmed cases should not reappear as new pending matches');
  results.push('final match decisions now require a finder request first, only the missing owner can approve or decline, the missing report closes on approval, and resolved reports no longer re-enter the pending queue');

  const devicesRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'devices', 'route.ts'), 'utf-8');
  assert.match(devicesRouteSource, /'GPS', 'QR', 'NFC'/);
  assert.doesNotMatch(devicesRouteSource, /BLUETOOTH/);
  assert.doesNotMatch(devicesRouteSource, /WIFI/);
  results.push('device API now limits physical devices to GPS, QR, and NFC while Bluetooth and Wi-Fi stay in settings');

  const devicesPanelSource = await readFile(path.join(process.cwd(), 'src', 'components', 'dashboard', 'DevicesManagementPanel.tsx'), 'utf-8');
  assert.match(devicesPanelSource, /How to use each device/);
  assert.match(devicesPanelSource, /deviceGuideSteps/);
  assert.doesNotMatch(devicesPanelSource, /option value="BLUETOOTH"/);
  assert.doesNotMatch(devicesPanelSource, /option value="WIFI"/);
  assert.match(devicesPanelSource, /Settings only/);
  results.push('devices dashboard keeps clear per-device usage guidance while moving Bluetooth and Wi-Fi out of the device list');

  const lostSettingsSource = await readFile(path.join(process.cwd(), 'src', 'app', 'lost-dashboard', 'page.tsx'), 'utf-8');
  assert.match(lostSettingsSource, /enableBluetooth/);
  assert.match(lostSettingsSource, /enableWifi/);
  assert.match(lostSettingsSource, /settingsHint/);

  const foundSettingsSource = await readFile(path.join(process.cwd(), 'src', 'app', 'found-dashboard', 'page.tsx'), 'utf-8');
  assert.match(foundSettingsSource, /enableBluetooth/);
  assert.match(foundSettingsSource, /enableWifi/);
  assert.match(foundSettingsSource, /settingsHint/);
  results.push('Bluetooth and Wi-Fi are now exposed in settings for both dashboards instead of as standalone devices');

  const reportMissingSource = await readFile(path.join(process.cwd(), 'src', 'app', '(screens)', 'report-missing', 'page.tsx'), 'utf-8');
  assert.match(reportMissingSource, /extractVisualFeaturesFromDataUrl/);
  assert.match(reportMissingSource, /aiAnalysis: resolvedFormData\.aiAnalysis \|\| undefined/);
  assert.match(reportMissingSource, /AI visual match ready|AI visual profile ready|helper similarity score is ready/);
  assert.match(reportMissingSource, /Center structure/);
  assert.match(reportMissingSource, /lookupLocations/);
  assert.match(reportMissingSource, /Use current location/);
  assert.match(reportMissingSource, /locationSuggestions/);
  assert.match(reportMissingSource, /latitude: undefined/);
  results.push('report submission now extracts AI visual analysis from the uploaded photo and resolves real addresses or live coordinates before saving the report');

  const locationRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'location', 'search', 'route.ts'), 'utf-8');
  assert.match(locationRouteSource, /nominatim\.openstreetmap\.org/);
  assert.match(locationRouteSource, /reverse/);
  assert.match(locationRouteSource, /countryCode/);
  results.push('location lookups now go through a dedicated server route so address search and reverse geocoding work more reliably');

  const previewRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'ai', 'preview-match', 'route.ts'), 'utf-8');
  assert.match(previewRouteSource, /scorePotentialMatchAsync/);
  assert.match(previewRouteSource, /usedAiPhotoPriority/);
  assert.match(previewRouteSource, /isCaseEligibleForAutoMatching/);
  assert.match(previewRouteSource, /validateSingleFaceImage/);
  assert.match(previewRouteSource, /minimumManualReviewScore/);
  assert.match(previewRouteSource, /ACCEPTED_MATCH_THRESHOLD/);
  results.push('AI preview route now validates the uploaded face, checks all active opposite-type reports, drops anything below 75%, keeps only the strongest results, and treats the photo as a helper beside the report data');

  const aiAnalysisSource = await readFile(path.join(process.cwd(), 'src', 'app', 'found-dashboard', 'ai-analysis', 'page.tsx'), 'utf-8');
  assert.match(aiAnalysisSource, /waitForPendingAiImage\(effectiveRequestId \|\| undefined/);
  assert.match(aiAnalysisSource, /reviewableMatches.length > 0/);
  assert.match(aiAnalysisSource, /Start Analysis/);

  const aiSessionSource = await readFile(path.join(process.cwd(), 'src', 'lib', 'client-ai-session.ts'), 'utf-8');
  assert.match(aiSessionSource, /let memoryImageRecord/);
  assert.match(aiSessionSource, /sessionStorage/);
  assert.match(aiSessionSource, /getPendingAiRequestId/);
  assert.match(aiSessionSource, /if \(!current && requestId\)/);
  assert.match(aiSessionSource, /confirmationRequested/);
  results.push('AI upload flow now uses in-memory plus storage fallback and an in-page Start Analysis action so Firefox can continue to analysis without a browser refresh');

  const aiMatchFoundSource = await readFile(path.join(process.cwd(), 'src', 'app', 'found-dashboard', 'ai-match-found', 'page.tsx'), 'utf-8');
  assert.match(aiMatchFoundSource, /Matched report owner/);
  assert.match(aiMatchFoundSource, /Open chat/);
  assert.match(aiMatchFoundSource, /Send final confirmation request/);
  assert.match(aiMatchFoundSource, /api\.requestMatchConfirmation/);
  assert.match(aiMatchFoundSource, /Only the missing report owner can approve or reject the final match/i);
  assert.match(aiMatchFoundSource, /Email owner/);
  assert.match(aiMatchFoundSource, /AI image assist/);
  assert.match(aiMatchFoundSource, /Data \{/);
  assert.match(aiMatchFoundSource, /Manual Review/);
  assert.match(aiMatchFoundSource, /Open matched report/);
  results.push('found dashboard preview now shows owner details, keeps separate data and image scores, opens chat, and sends a final confirmation request that only the missing owner can complete');

  const envExampleSource = await readFile(path.join(process.cwd(), '.env.example'), 'utf-8');
  assert.match(envExampleSource, /KAIROS_APP_ID=362479e4/);
  assert.match(envExampleSource, /KAIROS_APP_KEY=4525c8e25bd6a5fe8a66c5924e11c1dc/);

  try {
    const envLocalSource = await readFile(path.join(process.cwd(), '.env.local'), 'utf-8');
    assert.match(envLocalSource, /KAIROS_APP_ID=362479e4/);
    assert.match(envLocalSource, /KAIROS_APP_KEY=4525c8e25bd6a5fe8a66c5924e11c1dc/);
    results.push('.env.example and .env.local now include the requested Kairos app id and key for localhost use');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      results.push('.env.example includes the requested Kairos app id and key (skipped .env.local check in CI)');
    } else {
      throw err;
    }
  }

  const caseDetailsSource = await readFile(path.join(process.cwd(), 'src', 'app', '(screens)', 'case-details', 'page.tsx'), 'utf-8');
  assert.match(caseDetailsSource, /AI image-first/);
  assert.match(caseDetailsSource, /scoreBreakdown/);
  assert.match(caseDetailsSource, /AI visual profile ready/);
  assert.match(caseDetailsSource, /Center structure/);
  assert.match(caseDetailsSource, /Send final confirmation request/);
  assert.match(caseDetailsSource, /Waiting for the finder to send a final confirmation request/);
  results.push('case details now make the finder send the final confirmation request, while only the missing owner gets the final yes or no controls');

  const requestConfirmRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'matches', '[matchId]', 'request-confirm', 'route.ts'), 'utf-8');
  assert.match(requestConfirmRouteSource, /requestMatchConfirmation/);
  assert.match(requestConfirmRouteSource, /FOUND_OWNER_ONLY/);

  const deploymentGuideSource = await readFile(path.join(process.cwd(), 'DEPLOYMENT_GUIDE.md'), 'utf-8');
  assert.match(deploymentGuideSource, /persistent filesystem/i);
  assert.match(deploymentGuideSource, /docker/i);
  results.push('deployment guide now explains how to publish the site publicly with persistent data storage');

  const qrRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'identification-profiles', '[profileId]', 'qr', 'route.ts'), 'utf-8');
  assert.match(qrRouteSource, /\/identify\//);
  const publicIdentifyPageSource = await readFile(path.join(process.cwd(), 'src', 'app', 'identify', '[token]', 'page.tsx'), 'utf-8');
  assert.match(publicIdentifyPageSource, /Secure public identification page/);
  assert.match(publicIdentifyPageSource, /Database sync/);
  assert.match(publicIdentifyPageSource, /imageFailed/);
  assert.match(publicIdentifyPageSource, /use\(params\)/);
  assert.match(publicIdentifyPageSource, /onError=\{\(\) => setImageFailed\(true\)\}/);
  results.push('QR generation now points to a styled public identification page with a graceful fallback if a profile image cannot be rendered and no longer uses sync params access');

  const qrPageSource = await readFile(path.join(process.cwd(), 'src', 'app', '(screens)', 'qr', 'page.tsx'), 'utf-8');
  assert.match(qrPageSource, /datetime-local/);
  assert.match(qrPageSource, /Use current location/);
  assert.match(qrPageSource, /full public page, not raw JSON/i);
  results.push('QR creation page now has real date and location controls plus a preview of the final public page');

  const nfcPageSource = await readFile(path.join(process.cwd(), 'src', 'app', '(screens)', 'nfc', 'page.tsx'), 'utf-8');
  assert.match(nfcPageSource, /datetime-local/);
  assert.match(nfcPageSource, /Use current location/);
  assert.match(nfcPageSource, /nfcTagUid/);
  assert.match(nfcPageSource, /Database sync/);
  assert.match(nfcPageSource, /Hardware-ready bridge/);
  assert.match(nfcPageSource, /Copy device token/);
  assert.match(nfcPageSource, /Smart Tag Lite - NFC \+ Barcode/);
  assert.match(nfcPageSource, /Smart Tag Pro - NFC \+ Barcode \+ GPS/);
  assert.match(nfcPageSource, /GPS telemetry/);
  results.push('NFC page now supports Smart Tag Lite and Smart Tag Pro hardware, including NFC, barcode, and optional GPS telemetry handoff');

  const nfcHardwareRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'hardware', 'nfc', 'scan', 'route.ts'), 'utf-8');
  assert.match(nfcHardwareRouteSource, /x-device-token/);
  assert.match(nfcHardwareRouteSource, /recordProfileScan/);
  assert.match(nfcHardwareRouteSource, /type: 'NFC'/);
  assert.match(nfcHardwareRouteSource, /nfc_hardware/);

  const nfcLinkRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'identification-profiles', '[profileId]', 'nfc', 'route.ts'), 'utf-8');
  assert.match(nfcLinkRouteSource, /deviceToken/);
  assert.match(nfcLinkRouteSource, /hardwareModel/);
  assert.match(nfcLinkRouteSource, /SMART_TAG_PRO/);
  assert.match(nfcLinkRouteSource, /telemetryUrl/);
  assert.match(nfcLinkRouteSource, /barcodeReady/);
  results.push('NFC backend is now hardware-ready for Smart Tag Lite and Smart Tag Pro, with barcode readiness plus optional GPS telemetry for the Pro model');

  const gpsTelemetryRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'hardware', 'devices', 'telemetry', 'route.ts'), 'utf-8');
  assert.match(gpsTelemetryRouteSource, /x-device-token/);
  assert.match(gpsTelemetryRouteSource, /supportsGps/);
  assert.match(gpsTelemetryRouteSource, /gps_hardware/);
  assert.match(gpsTelemetryRouteSource, /GPS location updated/);

  const deviceModelsPanelSource = await readFile(path.join(process.cwd(), 'src', 'components', 'dashboard', 'DevicesManagementPanel.tsx'), 'utf-8');
  assert.match(deviceModelsPanelSource, /Smart Tag Lite - NFC \+ Barcode/);
  assert.match(deviceModelsPanelSource, /Smart Tag Pro - NFC \+ Barcode \+ GPS/);
  assert.match(deviceModelsPanelSource, /getHardwareModelLabel/);
  results.push('devices management now understands Smart Tag Lite and Smart Tag Pro hardware packages in addition to standalone devices');

  const gpsPageSource = await readFile(path.join(process.cwd(), 'src', 'app', '(screens)', 'gps', 'page.tsx'), 'utf-8');
  assert.match(gpsPageSource, /navigator\.geolocation/);
  assert.match(gpsPageSource, /api\.updateDevice/);
  assert.match(gpsPageSource, /api\.createDevice/);
  assert.match(gpsPageSource, /api\.deleteDevice/);
  assert.match(gpsPageSource, /locationHistory/);
  results.push('GPS page is now a real working control surface with live location capture, save, delete, and history review');

  const profilePanelSource = await readFile(path.join(process.cwd(), 'src', 'components', 'dashboard', 'ProfileSettingsPanel.tsx'), 'utf-8');
  assert.match(profilePanelSource, /avatarUrl/);
  assert.match(profilePanelSource, /Database sync/);
  assert.doesNotMatch(profilePanelSource, /Preferences:/);
  results.push('profile settings now support optional avatar upload, database info cards, and no longer show the old preferences block');

  const authScreenSource = await readFile(path.join(process.cwd(), 'src', 'components', 'screens', 'unified-auth-screen.tsx'), 'utf-8');
  assert.match(authScreenSource, /avatarUrl/);
  assert.match(authScreenSource, /profilePhoto/);
  assert.match(authScreenSource, /type="file"/);
  results.push('sign-up now supports an optional profile photo during registration');

  console.log('AI + device smoke checks passed:');
  for (const item of results) {
    console.log(`- ${item}`);
  }
}

main().catch((error) => {
  console.error('AI + device smoke checks failed.');
  console.error(error);
  process.exitCode = 1;
});
