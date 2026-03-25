import { describe, expect, it } from "vitest";
import { DEFAULT_BASS_PARAMS, DEFAULT_GOMPERTZ_PARAMS } from "../forecast/modelCalculations";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import { createStorylineForecastViewModel } from "./storylineModelForecast";

describe("createStorylineForecastViewModel", () => {
  it("builds a mixed history and forecast chart payload", () => {
    const bundle = createPublishedBundleFixture();
    const model = createStorylineForecastViewModel(
      bundle,
      "st_001",
      "bass_diffusion",
      DEFAULT_BASS_PARAMS
    );

    expect(model).not.toBeNull();
    expect(model?.chartPoints.some((point) => point.actual !== null)).toBe(true);
    expect(model?.chartPoints.some((point) => point.forecast !== null)).toBe(true);
    expect(model?.chartPoints.at(1)?.forecast).toBe(72);
    expect(model?.chartPoints.filter((point) => point.isForecast)[0]?.forecast).toBe(79);
    expect(model?.splitLabel).toBeTruthy();
    expect(model?.qualityLabel.length).toBeGreaterThan(0);
  });

  it("keeps the requested storyline and model label", () => {
    const bundle = createPublishedBundleFixture();
    const model = createStorylineForecastViewModel(
      bundle,
      "st_002",
      "gompertz",
      { ...DEFAULT_GOMPERTZ_PARAMS, a: 1.08, b: 3.1, c: 0.29 },
      5
    );

    expect(model?.storylineId).toBe("st_002");
    expect(model?.modelId).toBe("gompertz");
    expect(model?.modelLabel).toContain("Gompertz");
    expect(model?.chartPoints.filter((point) => point.isForecast)).toHaveLength(5);
  });

  it("returns null when the storyline does not exist", () => {
    const bundle = createPublishedBundleFixture();
    const model = createStorylineForecastViewModel(
      bundle,
      "missing",
      "bass_diffusion",
      DEFAULT_BASS_PARAMS
    );

    expect(model).toBeNull();
  });
});
