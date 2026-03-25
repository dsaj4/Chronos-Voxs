import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASS_PARAMS,
  DEFAULT_GOMPERTZ_PARAMS,
  computeFitQuality,
  runModel
} from "./modelCalculations";

describe("modelCalculations", () => {
  it("returns an empty result when there is no historical data", () => {
    const result = runModel({
      modelId: "bass_diffusion",
      params: DEFAULT_BASS_PARAMS,
      historicalData: [],
      forecastHorizon: 4
    });

    expect(result.historical).toEqual([]);
    expect(result.forecast).toEqual([]);
    expect(result.fitQuality.grade).toBe("poor");
  });

  it("generates fitted history and forecast points for bass diffusion", () => {
    const result = runModel({
      modelId: "bass_diffusion",
      params: DEFAULT_BASS_PARAMS,
      historicalData: [
        { bucket_index: 0, heat_index: 43 },
        { bucket_index: 1, heat_index: 66 }
      ],
      forecastHorizon: 3
    });

    expect(result.historical).toHaveLength(2);
    expect(result.forecast).toHaveLength(3);
    expect(result.forecast[0]?.lower).toBeLessThan(result.forecast[0]?.value ?? 0);
    expect(result.forecast[0]?.upper).toBeGreaterThan(result.forecast[0]?.value ?? 0);
    expect(result.peakValue).toBeGreaterThan(0);
  });

  it("generates fitted history and forecast points for gompertz", () => {
    const result = runModel({
      modelId: "gompertz",
      params: DEFAULT_GOMPERTZ_PARAMS,
      historicalData: [
        { bucket_index: 0, heat_index: 15 },
        { bucket_index: 1, heat_index: 18 },
        { bucket_index: 2, heat_index: 52 }
      ],
      forecastHorizon: 2
    });

    expect(result.historical).toHaveLength(3);
    expect(result.forecast).toHaveLength(2);
    expect(result.forecast[1]?.delta).not.toBeNaN();
    expect(result.fitQuality.rmse).toBeGreaterThanOrEqual(0);
  });

  it("computes stable fit quality metrics", () => {
    const quality = computeFitQuality([40, 60, 80], [42, 58, 79]);

    expect(quality.rmse).toBeCloseTo(1.732, 2);
    expect(quality.mae).toBeCloseTo(1.666, 2);
    expect(quality.r2).toBeGreaterThan(0.98);
  });
});
