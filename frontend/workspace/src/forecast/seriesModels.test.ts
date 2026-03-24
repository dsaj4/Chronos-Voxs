import { describe, expect, it } from "vitest";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import {
  createStorylineForecastSelection,
  formatBucketStart,
  getPublishedReasoningForSeries
} from "./seriesModels";

describe("formatBucketStart", () => {
  it("preserves day buckets as-is", () => {
    expect(formatBucketStart("2026-03-12", "day")).toBe("2026-03-12");
  });

  it("formats hourly buckets without dropping the hour", () => {
    expect(formatBucketStart("2026-03-12T14:00:00", "hour")).toBe("2026-03-12 14:00");
  });

  it("keeps published reasoning available for every storyline and model switch", () => {
    const bundle = createPublishedBundleFixture();

    for (const storylineId of ["st_001", "st_002"] as const) {
      for (const modelId of ["bass_diffusion", "gompertz"] as const) {
        const selection = createStorylineForecastSelection(bundle, storylineId, modelId);
        const reasoning = getPublishedReasoningForSeries(bundle, storylineId, modelId);

        expect(selection.activeSeries?.model_id).toBe(modelId);
        expect(selection.reasonText.length).toBeGreaterThan(0);
        expect(reasoning).not.toBeNull();
        expect(reasoning?.explanation.length).toBeGreaterThan(0);
        expect(reasoning?.confidence_note.length).toBeGreaterThan(0);
        expect(reasoning?.comparison_summary.length).toBeGreaterThan(0);
      }
    }
  });
});
