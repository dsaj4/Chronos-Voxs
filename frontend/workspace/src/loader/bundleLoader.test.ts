import { describe, expect, it } from "vitest";
import { resolvePublishedBundleUrl } from "./bundleLoader";

describe("resolvePublishedBundleUrl", () => {
  it("falls back to the default published bundle when no override is provided", () => {
    expect(resolvePublishedBundleUrl("")).toBe("/bundles/golden-forecast-bundle.ai-agent-practicalization.json");
  });

  it("uses the bundle query parameter as a lightweight frontend inspection entrypoint", () => {
    expect(resolvePublishedBundleUrl("?bundle=/bundles/phase1-simulated-bundle.json")).toBe(
      "/bundles/phase1-simulated-bundle.json"
    );
  });
});
