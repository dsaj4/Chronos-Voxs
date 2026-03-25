import type { ForecastModelId } from "../loader/publishedTypes";

export interface BassParams {
  p: number;
  q: number;
  m: number;
}

export interface GompertzParams {
  a: number;
  b: number;
  c: number;
}

export type ModelParams = BassParams | GompertzParams;

export interface ModelPoint {
  t: number;
  value: number;
  lower?: number;
  upper?: number;
  delta: number;
}

export interface FitQuality {
  rmse: number;
  r2: number;
  mae: number;
  grade: "excellent" | "good" | "fair" | "poor";
}

export interface RunModelOptions {
  modelId: ForecastModelId;
  params: ModelParams;
  historicalData: Array<{
    bucket_index: number;
    heat_index: number;
  }>;
  forecastHorizon: number;
}

export interface RunModelResult {
  historical: ModelPoint[];
  forecast: ModelPoint[];
  peakIndex: number;
  peakValue: number;
  fitQuality: FitQuality;
}

export const DEFAULT_BASS_PARAMS: BassParams = {
  p: 0.03,
  q: 0.38,
  m: 0.95
};

export const DEFAULT_GOMPERTZ_PARAMS: GompertzParams = {
  a: 1.0,
  b: 2.5,
  c: 0.35
};

export const MODEL_DEFAULT_PARAMS = {
  bass_diffusion: DEFAULT_BASS_PARAMS,
  gompertz: DEFAULT_GOMPERTZ_PARAMS
} satisfies Record<ForecastModelId, ModelParams>;

export const BASS_PARAM_RANGES = {
  p: {
    min: 0.001,
    max: 0.1,
    step: 0.001,
    label: "Innovation p",
    description: "External trigger strength"
  },
  q: {
    min: 0.1,
    max: 0.8,
    step: 0.01,
    label: "Imitation q",
    description: "Word-of-mouth acceleration"
  },
  m: {
    min: 0.5,
    max: 1.1,
    step: 0.01,
    label: "Ceiling m",
    description: "Normalized adoption ceiling"
  }
} as const;

export const GOMPERTZ_PARAM_RANGES = {
  a: {
    min: 0.5,
    max: 1.2,
    step: 0.01,
    label: "Asymptote a",
    description: "Upper heat ceiling"
  },
  b: {
    min: 0.5,
    max: 5,
    step: 0.1,
    label: "Shift b",
    description: "Peak timing offset"
  },
  c: {
    min: 0.1,
    max: 0.8,
    step: 0.01,
    label: "Growth c",
    description: "Curve steepness"
  }
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeBassDensity(t: number, params: BassParams) {
  const { p, q, m } = params;
  const pq = p + q;
  const decay = Math.exp(-pq * t);
  const adoption = (1 - decay) / (1 + (q / p) * decay);
  const density = (p + q * adoption) * (1 - adoption);
  return clamp(density * (m / Math.max(0.2, p + q / 4)), 0, m * 1.15);
}

function computeBassSequence(totalSteps: number, params: BassParams, normalizedMean: number) {
  const raw = Array.from({ length: totalSteps }, (_, index) => computeBassDensity(index, params));
  const rawMean = raw.reduce((sum, value) => sum + value, 0) / Math.max(raw.length, 1);
  const scale = rawMean > 0 ? normalizedMean / rawMean : 1;

  return raw.map((value) => clamp(value * scale, 0, Math.max(params.m * 1.2, 1.25)));
}

function computeGompertzPoint(t: number, params: GompertzParams) {
  const { a, b, c } = params;
  return a * Math.exp(-b * Math.exp(-c * t));
}

function computeGompertzSequence(totalSteps: number, params: GompertzParams) {
  const raw = Array.from({ length: totalSteps }, (_, index) => computeGompertzPoint(index, params));
  const rawMax = Math.max(...raw, 0.001);
  const scale = params.a / rawMax;

  return raw.map((value) => clamp(value * scale, 0, Math.max(params.a * 1.05, 1.25)));
}

function addConfidenceIntervals(
  points: ModelPoint[],
  baseUncertainty: number,
  growthRate: number,
  ceiling: number
) {
  return points.map((point, index) => {
    const spread = baseUncertainty + growthRate * index;
    return {
      ...point,
      lower: clamp(point.value - spread, 0, ceiling),
      upper: clamp(point.value + spread, 0, ceiling)
    };
  });
}

export function computeRMSE(actual: number[], predicted: number[]) {
  if (!actual.length || !predicted.length) {
    return 0;
  }

  const count = Math.min(actual.length, predicted.length);
  const squaredError = Array.from({ length: count }, (_, index) =>
    Math.pow(actual[index] - predicted[index], 2)
  ).reduce((sum, value) => sum + value, 0);

  return Math.sqrt(squaredError / count);
}

export function computeR2(actual: number[], predicted: number[]) {
  if (!actual.length || !predicted.length) {
    return 0;
  }

  const count = Math.min(actual.length, predicted.length);
  const actualSlice = actual.slice(0, count);
  const mean = actualSlice.reduce((sum, value) => sum + value, 0) / count;
  const totalVariance = actualSlice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0);

  if (totalVariance === 0) {
    return 1;
  }

  const residualVariance = Array.from({ length: count }, (_, index) =>
    Math.pow(actual[index] - predicted[index], 2)
  ).reduce((sum, value) => sum + value, 0);

  return clamp(1 - residualVariance / totalVariance, -1, 1);
}

export function computeMAE(actual: number[], predicted: number[]) {
  if (!actual.length || !predicted.length) {
    return 0;
  }

  const count = Math.min(actual.length, predicted.length);
  const totalError = Array.from({ length: count }, (_, index) =>
    Math.abs(actual[index] - predicted[index])
  ).reduce((sum, value) => sum + value, 0);

  return totalError / count;
}

export function gradeFitQuality(rmse: number, r2: number): FitQuality["grade"] {
  if (r2 >= 0.9 && rmse <= 4) {
    return "excellent";
  }
  if (r2 >= 0.75 && rmse <= 8) {
    return "good";
  }
  if (r2 >= 0.45 && rmse <= 14) {
    return "fair";
  }
  return "poor";
}

export function computeFitQuality(actual: number[], predicted: number[]): FitQuality {
  const rmse = computeRMSE(actual, predicted);
  const r2 = computeR2(actual, predicted);
  const mae = computeMAE(actual, predicted);

  return {
    rmse,
    r2,
    mae,
    grade: gradeFitQuality(rmse, r2)
  };
}

export function runModel({
  modelId,
  params,
  historicalData,
  forecastHorizon
}: RunModelOptions): RunModelResult {
  if (!historicalData.length) {
    return {
      historical: [],
      forecast: [],
      peakIndex: 0,
      peakValue: 0,
      fitQuality: {
        rmse: 0,
        r2: 0,
        mae: 0,
        grade: "poor"
      }
    };
  }

  const sortedHistory = [...historicalData].sort((left, right) => left.bucket_index - right.bucket_index);
  const historicalValues = sortedHistory.map((point) => point.heat_index);
  const historicalMax = Math.max(...historicalValues, 1);
  const historicalMean = historicalValues.reduce((sum, value) => sum + value, 0) / historicalValues.length;
  const normalizedMean = historicalMean / historicalMax;
  const totalSteps = sortedHistory.length + forecastHorizon;
  const normalizedSequence =
    modelId === "bass_diffusion"
      ? computeBassSequence(totalSteps, params as BassParams, normalizedMean)
      : computeGompertzSequence(totalSteps, params as GompertzParams);
  const scaledSequence = normalizedSequence.map((value, index) => value * historicalMax);
  const firstBucketIndex = sortedHistory[0]?.bucket_index ?? 0;

  const historical = scaledSequence.slice(0, sortedHistory.length).map((value, index) => ({
    t: firstBucketIndex + index,
    value,
    delta: index === 0 ? 0 : value - scaledSequence[index - 1]
  }));
  const fitQuality = computeFitQuality(
    historicalValues,
    historical.map((point) => point.value)
  );
  const forecastBase = scaledSequence.slice(sortedHistory.length).map((value, index) => {
    const previousValue =
      index === 0 ? historical.at(-1)?.value ?? value : scaledSequence[sortedHistory.length + index - 1];
    return {
      t: firstBucketIndex + sortedHistory.length + index,
      value,
      delta: value - previousValue
    };
  });
  const uncertaintyBase = Math.max(historicalMax * 0.04, fitQuality.rmse, 1);
  const uncertaintyGrowth = Math.max(historicalMax * 0.015, fitQuality.rmse * 0.2, 0.5);
  const valueCeiling = Math.max(historicalMax * 1.3, ...forecastBase.map((point) => point.value), historicalMax);
  const forecast = addConfidenceIntervals(forecastBase, uncertaintyBase, uncertaintyGrowth, valueCeiling);
  const allPoints = [...historical, ...forecast];
  const peakPoint = allPoints.reduce((best, point) => (point.value > best.value ? point : best), allPoints[0]);

  return {
    historical,
    forecast,
    peakIndex: peakPoint.t,
    peakValue: peakPoint.value,
    fitQuality
  };
}
