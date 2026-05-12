import type { AiVisualFeatures, CaseAiAnalysis } from '@/lib/shared-types';

const GRID_SIZE = 32;
const HASH_SIZE = 8;
const HISTOGRAM_BINS = 12;
const GRADIENT_BINS = 8;
const PROFILE_BINS = 8;
const CENTER_REGION_START = 8;
const CENTER_REGION_SIZE = 16;
const LOCAL_HASH_SIZE = 4;
const FOCUS_REGION_X = 9;
const FOCUS_REGION_Y = 4;
const FOCUS_REGION_WIDTH = 14;
const FOCUS_REGION_HEIGHT = 14;

export type VisualComparisonResult = {
  score: number;
  hashSimilarity: number;
  colorSimilarity: number;
  edgeSimilarity: number;
  brightnessSimilarity: number;
  aspectSimilarity: number;
  structureSimilarity: number;
  centerSimilarity: number;
  localHashSimilarity: number;
  gradientSimilarity: number;
  profileSimilarity: number;
  focusSimilarity: number;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const saturation = max === 0 ? 0 : delta / max;
  const value = max;
  return { hue, saturation, value };
}

function hammingSimilarity(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return 0;
  let same = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) same += 1;
  }
  return same / left.length;
}

function histogramIntersection(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
  let intersection = 0;
  for (let index = 0; index < left.length; index += 1) {
    intersection += Math.min(left[index], right[index]);
  }
  return clamp01(intersection);
}

function roundMetric(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeMetricArray(value: unknown, maxLength: number): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .slice(0, maxLength);
  return normalized.length ? normalized : undefined;
}

function compareHashCollections(left?: string[], right?: string[]) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) {
    return undefined;
  }
  const similarities = left.map((value, index) => hammingSimilarity(value, right[index] || ''));
  return similarities.length ? roundMetric(average(similarities)) : undefined;
}

function buildNormalizedProfile(values: number[], bins = PROFILE_BINS) {
  if (!values.length) {
    return Array.from({ length: bins }, () => 0);
  }

  const reduced = Array.from({ length: bins }, (_, index) => {
    const start = Math.floor((index * values.length) / bins);
    const end = Math.max(start + 1, Math.floor(((index + 1) * values.length) / bins));
    let total = 0;
    for (let cursor = start; cursor < Math.min(values.length, end); cursor += 1) {
      total += values[cursor] || 0;
    }
    return total;
  });

  const grandTotal = reduced.reduce((sum, value) => sum + value, 0);
  if (grandTotal <= 0) {
    return Array.from({ length: bins }, () => 0);
  }
  return reduced.map((value) => roundMetric(value / grandTotal));
}

function buildResampledGrid(
  grid: number[][],
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const sourceRows = grid.length;
  const sourceColumns = grid[0]?.length || 0;
  const sampled = Array.from({ length: targetHeight }, () => Array.from({ length: targetWidth }, () => 0));

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const startY = sourceY + (targetY * sourceHeight) / targetHeight;
    const endY = sourceY + ((targetY + 1) * sourceHeight) / targetHeight;

    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const startX = sourceX + (targetX * sourceWidth) / targetWidth;
      const endX = sourceX + ((targetX + 1) * sourceWidth) / targetWidth;
      let total = 0;
      let weight = 0;

      for (let sourceRow = Math.max(0, Math.floor(startY)); sourceRow < Math.min(sourceRows, Math.ceil(endY)); sourceRow += 1) {
        const yStart = Math.max(startY, sourceRow);
        const yEnd = Math.min(endY, sourceRow + 1);
        const yWeight = Math.max(0, yEnd - yStart);
        if (yWeight === 0) continue;

        for (let sourceColumn = Math.max(0, Math.floor(startX)); sourceColumn < Math.min(sourceColumns, Math.ceil(endX)); sourceColumn += 1) {
          const xStart = Math.max(startX, sourceColumn);
          const xEnd = Math.min(endX, sourceColumn + 1);
          const xWeight = Math.max(0, xEnd - xStart);
          if (xWeight === 0) continue;

          const cellWeight = xWeight * yWeight;
          total += (grid[sourceRow]?.[sourceColumn] || 0) * cellWeight;
          weight += cellWeight;
        }
      }

      sampled[targetY][targetX] = weight > 0 ? total / weight : 0;
    }
  }

  return sampled;
}

function createAverageHashFromGrid(
  grid: number[][],
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  hashSize = HASH_SIZE
) {
  const sampled = buildResampledGrid(grid, sourceX, sourceY, sourceWidth, sourceHeight, hashSize, hashSize);
  const flattened = sampled.flat();
  const mean = average(flattened);
  return flattened.map((value) => (value >= mean ? '1' : '0')).join('');
}

function createDifferenceHashFromGrid(
  grid: number[][],
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  hashWidth = HASH_SIZE,
  hashHeight = HASH_SIZE
) {
  const sampled = buildResampledGrid(grid, sourceX, sourceY, sourceWidth, sourceHeight, hashWidth + 1, hashHeight);
  const bits: string[] = [];
  for (let row = 0; row < hashHeight; row += 1) {
    for (let column = 0; column < hashWidth; column += 1) {
      bits.push(sampled[row][column] >= sampled[row][column + 1] ? '1' : '0');
    }
  }
  return bits.join('');
}

function computeStructuralSignals(grayscaleGrid: number[][]) {
  const edgeGrid = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 0));
  const gradientHistogram = Array.from({ length: GRADIENT_BINS }, () => 0);
  const rowTotals = Array.from({ length: GRID_SIZE }, () => 0);
  const columnTotals = Array.from({ length: GRID_SIZE }, () => 0);
  let edgeTotal = 0;
  let centerEdgeTotal = 0;
  let edgeSamples = 0;
  let centerSamples = 0;

  for (let y = 1; y < GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < GRID_SIZE - 1; x += 1) {
      const horizontal = grayscaleGrid[y][x + 1] - grayscaleGrid[y][x - 1];
      const vertical = grayscaleGrid[y + 1][x] - grayscaleGrid[y - 1][x];
      const magnitude = Math.min(1, Math.hypot(horizontal, vertical) / 255);
      edgeGrid[y][x] = magnitude;
      edgeTotal += magnitude;
      edgeSamples += 1;
      rowTotals[y] += magnitude;
      columnTotals[x] += magnitude;

      if (
        x >= CENTER_REGION_START &&
        x < CENTER_REGION_START + CENTER_REGION_SIZE &&
        y >= CENTER_REGION_START &&
        y < CENTER_REGION_START + CENTER_REGION_SIZE
      ) {
        centerEdgeTotal += magnitude;
        centerSamples += 1;
      }

      if (magnitude > 0) {
        const angle = (Math.atan2(vertical, horizontal) + Math.PI) / (2 * Math.PI);
        const bucket = Math.min(GRADIENT_BINS - 1, Math.floor(angle * GRADIENT_BINS));
        gradientHistogram[bucket] += magnitude;
      }
    }
  }

  const gradientTotal = gradientHistogram.reduce((sum, value) => sum + value, 0);

  return {
    edgeGrid,
    gradientHistogram: gradientTotal > 0
      ? gradientHistogram.map((value) => roundMetric(value / gradientTotal))
      : Array.from({ length: GRADIENT_BINS }, () => 0),
    rowProfile: buildNormalizedProfile(rowTotals),
    columnProfile: buildNormalizedProfile(columnTotals),
    edgeDensity: roundMetric(edgeSamples > 0 ? edgeTotal / edgeSamples : 0),
    centerEdgeDensity: roundMetric(centerSamples > 0 ? centerEdgeTotal / centerSamples : 0)
  };
}

export function buildAiVisualSummary(features: AiVisualFeatures) {
  const centerDensity = features.centerEdgeDensity ?? features.edgeDensity;
  const framingDescription = features.aspectRatio >= 1.2 ? 'landscape framing' : features.aspectRatio <= 0.85 ? 'portrait framing' : 'balanced framing';
  const centerDescription = centerDensity >= 0.32 ? 'clear center features' : centerDensity <= 0.16 ? 'soft center features' : 'balanced center features';
  const structureDescription = features.edgeDensity >= 0.35 ? 'rich structural detail' : features.edgeDensity <= 0.18 ? 'soft structural detail' : 'balanced structural detail';
  return `AI visual profile ready: ${framingDescription}, ${centerDescription}, ${structureDescription}.`;
}

export function createAiAnalysis(features: AiVisualFeatures, generatedAt = new Date().toISOString()): CaseAiAnalysis {
  return {
    summary: buildAiVisualSummary(features),
    generatedAt,
    features
  };
}

export function compareAiVisualFeatures(left?: AiVisualFeatures, right?: AiVisualFeatures): VisualComparisonResult {
  if (!left || !right) {
    return {
      score: 0,
      hashSimilarity: 0,
      colorSimilarity: 0,
      edgeSimilarity: 0,
      brightnessSimilarity: 0,
      aspectSimilarity: 0,
      structureSimilarity: 0,
      centerSimilarity: 0,
      localHashSimilarity: 0,
      gradientSimilarity: 0,
      profileSimilarity: 0,
      focusSimilarity: 0
    };
  }

  const hashSimilarity = roundMetric(
    (hammingSimilarity(left.averageHash, right.averageHash) + hammingSimilarity(left.differenceHash, right.differenceHash)) / 2
  );

  const leftColorHistogram = normalizeMetricArray(left.colorHistogram, HISTOGRAM_BINS) || [];
  const rightColorHistogram = normalizeMetricArray(right.colorHistogram, HISTOGRAM_BINS) || [];
  const colorSimilarity = roundMetric(histogramIntersection(leftColorHistogram, rightColorHistogram));
  const edgeSimilarity = roundMetric(1 - Math.min(1, Math.abs(left.edgeDensity - right.edgeDensity)));
  const brightnessSimilarity = roundMetric(1 - Math.min(1, Math.abs(left.brightness - right.brightness)));
  const aspectSimilarity = roundMetric(1 - Math.min(1, Math.abs(Math.log(Math.max(0.05, left.aspectRatio) / Math.max(0.05, right.aspectRatio))) / Math.log(4)));

  const structureHashSimilarity = left.structureHash && right.structureHash
    ? roundMetric(hammingSimilarity(left.structureHash, right.structureHash))
    : hashSimilarity;

  const centerAverageSimilarity = left.centerAverageHash && right.centerAverageHash
    ? hammingSimilarity(left.centerAverageHash, right.centerAverageHash)
    : structureHashSimilarity;
  const centerDifferenceSimilarity = left.centerDifferenceHash && right.centerDifferenceHash
    ? hammingSimilarity(left.centerDifferenceHash, right.centerDifferenceHash)
    : hashSimilarity;
  const centerSimilarity = roundMetric((centerAverageSimilarity + centerDifferenceSimilarity) / 2);

  const focusAverageSimilarity = left.focusAverageHash && right.focusAverageHash
    ? hammingSimilarity(left.focusAverageHash, right.focusAverageHash)
    : centerAverageSimilarity;
  const focusDifferenceSimilarity = left.focusDifferenceHash && right.focusDifferenceHash
    ? hammingSimilarity(left.focusDifferenceHash, right.focusDifferenceHash)
    : centerDifferenceSimilarity;
  const focusStructureSimilarity = left.focusStructureHash && right.focusStructureHash
    ? hammingSimilarity(left.focusStructureHash, right.focusStructureHash)
    : structureHashSimilarity;
  const focusSimilarity = roundMetric((focusAverageSimilarity + focusDifferenceSimilarity + focusStructureSimilarity) / 3);

  const localHashSimilarity = compareHashCollections(left.quadrantHashes, right.quadrantHashes) ?? Math.max(centerSimilarity, focusSimilarity);

  const leftGradientHistogram = normalizeMetricArray(left.gradientHistogram, GRADIENT_BINS);
  const rightGradientHistogram = normalizeMetricArray(right.gradientHistogram, GRADIENT_BINS);
  const gradientSimilarity = leftGradientHistogram && rightGradientHistogram
    ? roundMetric(histogramIntersection(leftGradientHistogram, rightGradientHistogram))
    : edgeSimilarity;

  const leftRowProfile = normalizeMetricArray(left.rowProfile, PROFILE_BINS);
  const rightRowProfile = normalizeMetricArray(right.rowProfile, PROFILE_BINS);
  const leftColumnProfile = normalizeMetricArray(left.columnProfile, PROFILE_BINS);
  const rightColumnProfile = normalizeMetricArray(right.columnProfile, PROFILE_BINS);

  const rowSimilarity = leftRowProfile && rightRowProfile
    ? roundMetric(histogramIntersection(leftRowProfile, rightRowProfile))
    : undefined;
  const columnSimilarity = leftColumnProfile && rightColumnProfile
    ? roundMetric(histogramIntersection(leftColumnProfile, rightColumnProfile))
    : undefined;

  const profileSimilarity = rowSimilarity !== undefined && columnSimilarity !== undefined
    ? roundMetric((rowSimilarity + columnSimilarity) / 2)
    : rowSimilarity ?? columnSimilarity ?? roundMetric((edgeSimilarity + aspectSimilarity) / 2);

  const centerEdgeSimilarity = left.centerEdgeDensity !== undefined && right.centerEdgeDensity !== undefined
    ? roundMetric(1 - Math.min(1, Math.abs(left.centerEdgeDensity - right.centerEdgeDensity)))
    : edgeSimilarity;

  const structureSimilarity = roundMetric(
    clamp01(
      (structureHashSimilarity * 0.18) +
      (centerSimilarity * 0.16) +
      (focusSimilarity * 0.24) +
      (localHashSimilarity * 0.12) +
      (gradientSimilarity * 0.12) +
      (profileSimilarity * 0.10) +
      (centerEdgeSimilarity * 0.08)
    )
  );

  const structuralConfidence = roundMetric(
    clamp01(
      (structureSimilarity * 0.38) +
      (focusSimilarity * 0.24) +
      (gradientSimilarity * 0.14) +
      (profileSimilarity * 0.12) +
      (centerEdgeSimilarity * 0.08) +
      (aspectSimilarity * 0.04)
    )
  );

  const contextSimilarity = roundMetric(
    clamp01(
      (hashSimilarity * 0.18) +
      (centerSimilarity * 0.18) +
      (focusSimilarity * 0.24) +
      (localHashSimilarity * 0.10) +
      (edgeSimilarity * 0.10) +
      (aspectSimilarity * 0.08) +
      (brightnessSimilarity * 0.06) +
      (colorSimilarity * 0.06)
    )
  );

  let score = clamp01((structuralConfidence * 0.78) + (contextSimilarity * 0.22));

  if (structuralConfidence < 0.48 && centerSimilarity < 0.46) {
    score = Math.min(score, 0.44);
  }
  if (focusSimilarity < 0.46 && centerSimilarity < 0.5) {
    score = Math.min(score, 0.46);
  }
  if (structureSimilarity < 0.54 && gradientSimilarity < 0.5 && profileSimilarity < 0.5) {
    score = Math.min(score, 0.5);
  }
  if (centerSimilarity < 0.44 && localHashSimilarity < 0.4 && hashSimilarity < 0.45) {
    score = Math.min(score, 0.48);
  }
  if (focusSimilarity < 0.58 && centerSimilarity < 0.58 && localHashSimilarity < 0.58 && hashSimilarity < 0.6) {
    score = Math.min(score, 0.57);
  }
  if (structuralConfidence >= 0.7 && focusSimilarity >= 0.68 && (gradientSimilarity >= 0.64 || profileSimilarity >= 0.62)) {
    score = Math.max(score, 0.72);
  }
  if (structureSimilarity >= 0.78 && centerSimilarity >= 0.66 && focusSimilarity >= 0.72 && (profileSimilarity >= 0.6 || gradientSimilarity >= 0.64)) {
    score = Math.max(score, 0.8);
  }
  if (structureSimilarity >= 0.84 && centerSimilarity >= 0.74 && focusSimilarity >= 0.8 && localHashSimilarity >= 0.72) {
    score = Math.max(score, 0.88);
  }
  if (hashSimilarity >= 0.98 && centerSimilarity >= 0.97 && focusSimilarity >= 0.97 && localHashSimilarity >= 0.95) {
    score = Math.max(score, 0.98);
  }

  return {
    score: roundMetric(score, 2),
    hashSimilarity,
    colorSimilarity,
    edgeSimilarity,
    brightnessSimilarity,
    aspectSimilarity,
    structureSimilarity,
    centerSimilarity,
    localHashSimilarity: roundMetric(localHashSimilarity),
    gradientSimilarity,
    profileSimilarity,
    focusSimilarity
  };
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image for AI analysis.'));
    image.src = dataUrl;
  });
}

function getCanvasContext(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas is not available in this browser.');
  }
  return { canvas, context };
}

function computeFeaturesFromImageData(imageData: ImageData, width: number, height: number): AiVisualFeatures {
  const histogram = Array.from({ length: HISTOGRAM_BINS }, () => 0);
  const grayscaleGrid = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 0));
  let brightnessTotal = 0;
  let histogramSamples = 0;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const index = (y * GRID_SIZE + x) * 4;
      const alpha = imageData.data[index + 3] / 255;
      const red = Math.round((imageData.data[index] * alpha) + (255 * (1 - alpha)));
      const green = Math.round((imageData.data[index + 1] * alpha) + (255 * (1 - alpha)));
      const blue = Math.round((imageData.data[index + 2] * alpha) + (255 * (1 - alpha)));
      const grayscale = (0.299 * red) + (0.587 * green) + (0.114 * blue);
      grayscaleGrid[y][x] = grayscale;
      brightnessTotal += grayscale / 255;

      const { hue, saturation, value } = rgbToHsv(red, green, blue);
      const hueBucket = saturation < 0.12 ? 0 : Math.min(3, Math.floor(hue / 90));
      const valueBucket = Math.min(2, Math.floor(value * 3));
      histogram[(hueBucket * 3) + valueBucket] += 1;
      histogramSamples += 1;
    }
  }

  const structuralSignals = computeStructuralSignals(grayscaleGrid);

  return {
    version: 3,
    averageHash: createAverageHashFromGrid(grayscaleGrid, 0, 0, GRID_SIZE, GRID_SIZE),
    differenceHash: createDifferenceHashFromGrid(grayscaleGrid, 0, 0, GRID_SIZE, GRID_SIZE),
    structureHash: createAverageHashFromGrid(structuralSignals.edgeGrid, 0, 0, GRID_SIZE, GRID_SIZE),
    centerAverageHash: createAverageHashFromGrid(
      structuralSignals.edgeGrid,
      CENTER_REGION_START,
      CENTER_REGION_START,
      CENTER_REGION_SIZE,
      CENTER_REGION_SIZE
    ),
    centerDifferenceHash: createDifferenceHashFromGrid(
      structuralSignals.edgeGrid,
      CENTER_REGION_START,
      CENTER_REGION_START,
      CENTER_REGION_SIZE,
      CENTER_REGION_SIZE
    ),
    focusAverageHash: createAverageHashFromGrid(
      grayscaleGrid,
      FOCUS_REGION_X,
      FOCUS_REGION_Y,
      FOCUS_REGION_WIDTH,
      FOCUS_REGION_HEIGHT
    ),
    focusDifferenceHash: createDifferenceHashFromGrid(
      grayscaleGrid,
      FOCUS_REGION_X,
      FOCUS_REGION_Y,
      FOCUS_REGION_WIDTH,
      FOCUS_REGION_HEIGHT
    ),
    focusStructureHash: createAverageHashFromGrid(
      structuralSignals.edgeGrid,
      FOCUS_REGION_X,
      FOCUS_REGION_Y,
      FOCUS_REGION_WIDTH,
      FOCUS_REGION_HEIGHT
    ),
    quadrantHashes: [
      createAverageHashFromGrid(structuralSignals.edgeGrid, 0, 0, CENTER_REGION_SIZE, CENTER_REGION_SIZE, LOCAL_HASH_SIZE),
      createAverageHashFromGrid(structuralSignals.edgeGrid, CENTER_REGION_SIZE, 0, CENTER_REGION_SIZE, CENTER_REGION_SIZE, LOCAL_HASH_SIZE),
      createAverageHashFromGrid(structuralSignals.edgeGrid, 0, CENTER_REGION_SIZE, CENTER_REGION_SIZE, CENTER_REGION_SIZE, LOCAL_HASH_SIZE),
      createAverageHashFromGrid(structuralSignals.edgeGrid, CENTER_REGION_SIZE, CENTER_REGION_SIZE, CENTER_REGION_SIZE, CENTER_REGION_SIZE, LOCAL_HASH_SIZE)
    ],
    gradientHistogram: structuralSignals.gradientHistogram,
    rowProfile: structuralSignals.rowProfile,
    columnProfile: structuralSignals.columnProfile,
    colorHistogram: histogram.map((value) => roundMetric(value / Math.max(1, histogramSamples))),
    brightness: roundMetric(brightnessTotal / (GRID_SIZE * GRID_SIZE)),
    edgeDensity: structuralSignals.edgeDensity,
    centerEdgeDensity: structuralSignals.centerEdgeDensity,
    aspectRatio: roundMetric(width / Math.max(1, height)),
    width,
    height
  };
}

export async function extractVisualFeaturesFromDataUrl(dataUrl: string): Promise<CaseAiAnalysis> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('AI image analysis is only available in the browser.');
  }
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('The uploaded file is not a valid image.');
  }

  const image = await loadImage(dataUrl);
  const { context } = getCanvasContext(GRID_SIZE, GRID_SIZE);
  context.drawImage(image, 0, 0, GRID_SIZE, GRID_SIZE);
  const imageData = context.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const features = computeFeaturesFromImageData(imageData, image.naturalWidth || image.width || GRID_SIZE, image.naturalHeight || image.height || GRID_SIZE);
  return createAiAnalysis(features);
}
