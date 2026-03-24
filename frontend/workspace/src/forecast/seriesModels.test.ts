import { describe, expect, it } from "vitest";
import { formatBucketStart } from "./seriesModels";

describe("formatBucketStart", () => {
  it("preserves day buckets as-is", () => {
    expect(formatBucketStart("2026-03-12", "day")).toBe("2026-03-12");
  });

  it("formats hourly buckets without dropping the hour", () => {
    expect(formatBucketStart("2026-03-12T14:00:00", "hour")).toBe("2026-03-12 14:00");
  });
});
