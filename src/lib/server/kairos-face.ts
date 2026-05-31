import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const LOCAL_FACE_AI_SCRIPT = path.join(process.cwd(), 'scripts', 'local_face_ai.py');
const LOCAL_FACE_CACHE_LIMIT = 96;
const localFaceAnalysisCache = new Map<string, LocalFaceAnalysis>();

export const ACCEPTED_MATCH_THRESHOLD = 0.8;
export const MANUAL_REVIEW_THRESHOLD = 0.75;

export type MatchDecision = 'Accepted Match' | 'Manual Review' | 'No Match';
export type FaceValidationIssue = 'NO_FACE_DETECTED' | 'MULTIPLE_FACES' | 'UNSUPPORTED_IMAGE' | 'REMOTE_ERROR';

export type MatchDecisionInfo = {
  decision: MatchDecision;
  manualReview: boolean;
  accepted: boolean;
};

export type FaceValidationResult =
  | {
      ok: true;
      usedOnlineAi: true;
      faceCount: 1;
      confidence?: number;
      quality?: number;
    }
  | {
      ok: false;
      usedOnlineAi: boolean;
      issue: FaceValidationIssue;
      message: string;
      code?: number;
    };

export type KairosImageComparisonResult = {
  usedOnlineAi: boolean;
  similarity?: number;
  confidence?: number;
  bestSourceIndex?: number;
  bestTargetIndex?: number;
  comparedPairs: number;
  skippedPairs: number;
  warnings: string[];
};

type LocalFaceAnalysis =
  | {
      ok: true;
      faceCount: 1;
      confidence?: number;
      quality?: number;
      descriptor: number[];
    }
  | {
      ok: false;
      issue: FaceValidationIssue;
      message: string;
      faceCount?: number;
    };

type AnalyzeResponse = {
  ok?: boolean;
  results?: LocalFaceAnalysis[];
};

function toRoundedScore(value?: number) {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, Number(Number(value).toFixed(4))));
}

function setCachedAnalysis(cacheKey: string, value: LocalFaceAnalysis) {
  if (localFaceAnalysisCache.has(cacheKey)) {
    localFaceAnalysisCache.delete(cacheKey);
  }
  localFaceAnalysisCache.set(cacheKey, value);
  while (localFaceAnalysisCache.size > LOCAL_FACE_CACHE_LIMIT) {
    const oldest = localFaceAnalysisCache.keys().next().value;
    if (!oldest) break;
    localFaceAnalysisCache.delete(oldest);
  }
}

function getCacheKey(image: string) {
  return createHash('sha1').update(image.trim()).digest('hex');
}

function vectorCosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const l = Number(left[index]) || 0;
    const r = Number(right[index]) || 0;
    dot += l * r;
    leftNorm += l * l;
    rightNorm += r * r;
  }
  if (leftNorm <= 0 || rightNorm <= 0) return 0;
  const cosine = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  return Math.max(0, Math.min(1, Number(cosine.toFixed(6))));
}

function segmentSimilarity(left: number[], right: number[], start: number, length: number) {
  return vectorCosineSimilarity(left.slice(start, start + length), right.slice(start, start + length));
}

function compareFaceDescriptors(left: number[], right: number[]) {
  const histSimilarity = segmentSimilarity(left, right, 0, 32);
  const gradientSimilarity = segmentSimilarity(left, right, 32, 16);
  const textureSimilarity = segmentSimilarity(left, right, 48, 16);
  const patchSimilarity = segmentSimilarity(left, right, 64, 64);

  const weighted =
    (histSimilarity * 0.2) +
    (gradientSimilarity * 0.2) +
    (textureSimilarity * 0.26) +
    (patchSimilarity * 0.34);

  const score = Math.max(0, Math.min(1, Number(weighted.toFixed(4))));
  return {
    score,
    confidence: Math.max(score, Number((((gradientSimilarity + textureSimilarity + patchSimilarity) / 3)).toFixed(4))),
    breakdown: {
      histogram: histSimilarity,
      gradient: gradientSimilarity,
      texture: textureSimilarity,
      patch: patchSimilarity
    }
  };
}

async function getPythonCommands() {
  const commands = process.platform === 'win32'
    ? [['python'], ['py', '-3']]
    : [['python3'], ['python']];
  return commands;
}

async function runLocalFaceAnalysis(images: string[]) {
  const commands = await getPythonCommands();
  let lastError = 'Local face AI is unavailable.';

  for (const command of commands) {
    try {
      const result = await new Promise<AnalyzeResponse>((resolve, reject) => {
        const child = spawn(command[0], [...command.slice(1), LOCAL_FACE_AI_SCRIPT], {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
          stdout += String(chunk);
        });
        child.stderr.on('data', (chunk) => {
          stderr += String(chunk);
        });
        child.on('error', (error) => {
          reject(error);
        });
        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(stderr.trim() || `Local face AI exited with code ${code}.`));
            return;
          }
          try {
            resolve(JSON.parse(stdout || '{}') as AnalyzeResponse);
          } catch (error) {
            reject(error);
          }
        });

        child.stdin.end(JSON.stringify({ operation: 'analyze', images }));
      });

      if (Array.isArray(result.results)) {
        return result.results;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Local face AI execution failed.';
    }
  }

  throw new Error(lastError);
}

async function analyzeImages(images: string[]) {
  if (process.env.RETURN_FACE_AI_MOCK === '1') {
    return images.map((item) => {
      const value = String(item || '').trim();
      if (value.includes('NOFACE')) {
        return { ok: false as const, issue: 'NO_FACE_DETECTED' as const, message: 'No face detected.' };
      } else if (value.includes('MULTIFACE')) {
        return { ok: false as const, issue: 'MULTIPLE_FACES' as const, message: 'Multiple faces detected. Please use a photo with exactly one face.', faceCount: 2 };
      } else if (value.includes('CAR')) {
        return { ok: false as const, issue: 'NO_FACE_DETECTED' as const, message: 'No face detected.' };
      } else {
        const base = value.includes('FACE_A') ? 0.9 : value.includes('FACE_B') ? 0.7 : 0.5;
        const descriptor = Array.from({ length: 128 }, (_, i) => Number((base + ((i % 7) * 0.001)).toFixed(6)));
        return { ok: true as const, faceCount: 1 as const, confidence: 0.92, quality: 0.88, descriptor };
      }
    });
  }

  const results: LocalFaceAnalysis[] = new Array(images.length);
  const uncached: string[] = [];
  const uncachedIndexes: number[] = [];

  images.forEach((image, index) => {
    const cacheKey = getCacheKey(image);
    const cached = localFaceAnalysisCache.get(cacheKey);
    if (cached) {
      setCachedAnalysis(cacheKey, cached);
      results[index] = cached;
      return;
    }
    uncached.push(image);
    uncachedIndexes.push(index);
  });

  if (uncached.length > 0) {
    const analyzed = await runLocalFaceAnalysis(uncached);
    uncachedIndexes.forEach((originalIndex, analyzedIndex) => {
      const value = analyzed[analyzedIndex] || {
        ok: false,
        issue: 'REMOTE_ERROR',
        message: 'Local face AI returned an incomplete response.'
      } satisfies LocalFaceAnalysis;
      results[originalIndex] = value;
      setCachedAnalysis(getCacheKey(images[originalIndex]), value);
    });
  }

  return results;
}

export function isKairosConfigured() {
  return true;
}

export function getMatchDecision(score?: number): MatchDecisionInfo {
  const normalized = Number.isFinite(score) ? Number(score) : 0;
  if (normalized >= ACCEPTED_MATCH_THRESHOLD) {
    return {
      decision: 'Accepted Match',
      manualReview: false,
      accepted: true
    };
  }
  if (normalized >= MANUAL_REVIEW_THRESHOLD) {
    return {
      decision: 'Manual Review',
      manualReview: true,
      accepted: false
    };
  }
  return {
    decision: 'No Match',
    manualReview: false,
    accepted: false
  };
}

export async function validateSingleFaceImage(image: string): Promise<FaceValidationResult> {
  try {
    const [result] = await analyzeImages([image]);
    if (result?.ok) {
      return {
        ok: true,
        usedOnlineAi: true,
        faceCount: 1,
        confidence: toRoundedScore(result.confidence),
        quality: toRoundedScore(result.quality)
      };
    }

    if (result?.issue === 'NO_FACE_DETECTED' || result?.issue === 'MULTIPLE_FACES' || result?.issue === 'UNSUPPORTED_IMAGE') {
      return {
        ok: false,
        usedOnlineAi: true,
        issue: result.issue,
        message: result.message
      };
    }

    return {
      ok: false,
      usedOnlineAi: false,
      issue: 'REMOTE_ERROR',
      message: result?.message || 'Local face AI is unavailable.'
    };
  } catch (error) {
    return {
      ok: false,
      usedOnlineAi: false,
      issue: 'REMOTE_ERROR',
      message: error instanceof Error ? error.message : 'Local face AI is unavailable.'
    };
  }
}

export async function compareImageSetsWithKairos(sourceImages: string[], targetImages: string[]): Promise<KairosImageComparisonResult> {
  const allImages = [...sourceImages, ...targetImages];
  try {
    const analyzed = await analyzeImages(allImages);
    const sourceResults = analyzed.slice(0, sourceImages.length);
    const targetResults = analyzed.slice(sourceImages.length);

    let bestSimilarity: number | undefined;
    let bestConfidence: number | undefined;
    let bestSourceIndex: number | undefined;
    let bestTargetIndex: number | undefined;
    let comparedPairs = 0;
    let skippedPairs = 0;
    const warnings: string[] = [];

    for (let sourceIndex = 0; sourceIndex < sourceResults.length; sourceIndex += 1) {
      const source = sourceResults[sourceIndex];
      for (let targetIndex = 0; targetIndex < targetResults.length; targetIndex += 1) {
        const target = targetResults[targetIndex];
        if (!source?.ok || !target?.ok) {
          skippedPairs += 1;
          const issue = !source?.ok ? source.issue : target?.ok ? undefined : target.issue;
          if (issue === 'NO_FACE_DETECTED') {
            warnings.push(`Local face AI skipped one image pair because no face was detected (${sourceIndex + 1} vs ${targetIndex + 1}).`);
          } else if (issue === 'MULTIPLE_FACES') {
            warnings.push(`Local face AI skipped one image pair because it found multiple faces (${sourceIndex + 1} vs ${targetIndex + 1}).`);
          }
          continue;
        }

        comparedPairs += 1;
        const compared = compareFaceDescriptors(source.descriptor, target.descriptor);
        const qualityBoost = Math.min(source.confidence || 0.7, target.confidence || 0.7);
        const similarity = Math.max(0, Math.min(1, Number(((compared.score * 0.9) + (qualityBoost * 0.1)).toFixed(4))));
        const confidence = Math.max(similarity, Number((((compared.confidence * 0.85) + (qualityBoost * 0.15))).toFixed(4)));

        if (bestSimilarity === undefined || similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestConfidence = confidence;
          bestSourceIndex = sourceIndex;
          bestTargetIndex = targetIndex;
        }
      }
    }

    return {
      usedOnlineAi: sourceImages.length > 0 && targetImages.length > 0,
      similarity: bestSimilarity,
      confidence: bestConfidence,
      bestSourceIndex,
      bestTargetIndex,
      comparedPairs,
      skippedPairs,
      warnings: [...new Set(warnings)]
    };
  } catch (error) {
    return {
      usedOnlineAi: false,
      comparedPairs: 0,
      skippedPairs: sourceImages.length * targetImages.length,
      warnings: [error instanceof Error ? error.message : 'Local face AI is unavailable.']
    };
  }
}

export async function isLocalFaceAiScriptAvailable() {
  try {
    await access(LOCAL_FACE_AI_SCRIPT);
    return true;
  } catch {
    return false;
  }
}
