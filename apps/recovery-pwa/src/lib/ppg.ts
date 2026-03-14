export interface Sample {
  timestamp: number;
  redMean: number;
  greenMean: number;
}

export interface PpgOptions {
  prominenceFactor?: number;
  prominenceMin?: number;
  minRange?: number;
  minBpm?: number;
  maxBpm?: number;
  windowCount?: number;
}

const DEFAULT_OPTIONS: Required<PpgOptions> = {
  prominenceFactor: 0.015,
  prominenceMin: 1.0,
  minRange: 0.5,
  minBpm: 40,
  maxBpm: 200, // allows post-workout HR >120; MIN_INTERVAL_MS=300 still rejects very short noise; IQR/median filters handle outliers
  windowCount: 4,
};

export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function detrend(values: number[]): number[] {
  if (values.length < 3) return values;
  const n = values.length;
  const indices = values.map((_, i) => i);
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((acc, x, i) => acc + x * values[i]!, 0);
  const sumXX = indices.reduce((a, x) => a + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((v, i) => v - (slope * i + intercept));
}

export function computeBpmFromPeaks(
  samples: Sample[],
  useGreen: boolean,
  opts: PpgOptions = {}
): number | null {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const { prominenceFactor, prominenceMin, minRange, minBpm, maxBpm } = options;
  const MIN_INTERVAL_MS = 60000 / maxBpm;
  const MAX_INTERVAL_MS = 60000 / minBpm;

  if (samples.length < 30) return null;

  let values = samples.map((s) => (useGreen ? s.greenMean : s.redMean));
  values = detrend(values);
  const times = samples.map((s) => s.timestamp);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  if (range < minRange) return null;
  const prominence = Math.max(range * prominenceFactor, prominenceMin);
  const peaks: number[] = [];

  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    if (
      v >= values[i - 1]! &&
      v >= values[i - 2]! &&
      v >= values[i + 1]! &&
      v >= values[i + 2]! &&
      v >= minValue + prominence
    ) {
      peaks.push(times[i]!);
    }
  }

  if (peaks.length < 3) return null;

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const interval = peaks[i]! - peaks[i - 1]!;
    if (interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS) {
      intervals.push(interval);
    }
  }

  if (intervals.length < 2) return null;

  const sorted = [...intervals].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  const iqr = q3 - q1;
  let filtered = intervals.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
  if (filtered.length < 2) return null;
  const med = median(filtered);
  filtered = filtered.filter((x) => x >= med * 0.65 && x <= med * 1.5);
  if (filtered.length < 2) return null;
  const intervalEstimate = median(filtered);
  const bpm = Math.round(60000 / intervalEstimate);
  if (bpm >= minBpm && bpm <= maxBpm) return bpm;
  return null;
}

export function resolveBpm(green: number | null, red: number | null): number | null {
  if (green === null && red === null) return null;
  if (green === null) return red;
  if (red === null) return green;
  const [lo, hi] = green <= red ? [green, red] : [red, green];
  if (hi >= lo * 1.7 && hi <= lo * 2.3) return lo;
  return green;
}

export function areReadingsConsistent(
  readings: { bpm: number }[],
  tolerance: number,
  windowCount: number = DEFAULT_OPTIONS.windowCount
): boolean {
  if (readings.length < windowCount) return false;
  const last = readings.slice(-windowCount);
  const values = last.map((r) => r.bpm);
  const med = median(values);
  return values.every((v) => Math.abs(v - med) <= tolerance);
}

export function computeSignalQualityIndex(samples: Sample[]): number {
  if (samples.length < 30) return 0;
  const values = samples.map((s) => (s.redMean + s.greenMean) / 2);
  const range = Math.max(...values) - Math.min(...values);
  if (range < 0.5) return 0;
  const times = samples.map((s) => s.timestamp);
  const peakIndices: number[] = [];
  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i]!;
    if (
      v >= values[i - 1]! &&
      v >= values[i - 2]! &&
      v >= values[i + 1]! &&
      v >= values[i + 2]!
    ) {
      peakIndices.push(i);
    }
  }
  if (peakIndices.length < 2) return Math.min(1, range / 10);
  const intervals: number[] = [];
  for (let j = 1; j < peakIndices.length; j++) {
    intervals.push(times[peakIndices[j]!]! - times[peakIndices[j - 1]!]!);
  }
  const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const std = Math.sqrt(
    intervals.reduce((acc, x) => acc + (x - meanInterval) ** 2, 0) / intervals.length
  );
  const cv = meanInterval > 0 ? std / meanInterval : 1;
  const regularityScore = Math.max(0, 1 - cv * 2);
  return Math.min(1, (range / 5) * 0.5 + regularityScore * 0.5);
}
