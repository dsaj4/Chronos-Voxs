import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_BASS_PARAMS } from "../forecast/modelCalculations";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import { StorylinePanel } from "./StorylinePanel";
import { createStorylineForecastViewModel } from "./storylineModelForecast";

describe("StorylinePanel", () => {
  it("renders the integrated forecast band when forecast mode is open", () => {
    const bundle = createPublishedBundleFixture();
    const forecastModel = createStorylineForecastViewModel(
      bundle,
      "st_001",
      "bass_diffusion",
      DEFAULT_BASS_PARAMS
    );

    const markup = renderToStaticMarkup(
      <StorylinePanel
        bundle={bundle}
        activeStorylineId="st_001"
        forecastOpen
        forecastModel={forecastModel}
        selectedModelLabel="Bass Diffusion"
        onForecastOpenChange={() => undefined}
        onStorylineSelect={() => undefined}
      />
    );

    expect(markup).toContain("The Stream");
    expect(markup).toContain("storyline-stream__forecast-toggle--active");
    expect(markup).toContain("storyline-forecast");
    expect(markup).toContain("MODEL FORECAST / BASS DIFFUSION");
    expect(markup).toContain("storyline-stream__proportion");
    expect(markup).toContain("storyline-stream__proportion-share");
    expect(markup).not.toContain("storyline-stream__proportion-label");
  });

  it("keeps the stream page in chart-first mode when forecast mode is closed", () => {
    const bundle = createPublishedBundleFixture();

    const markup = renderToStaticMarkup(
      <StorylinePanel
        bundle={bundle}
        activeStorylineId="st_001"
        forecastOpen={false}
        forecastModel={null}
        selectedModelLabel="Bass Diffusion"
        onForecastOpenChange={() => undefined}
        onStorylineSelect={() => undefined}
      />
    );

    expect(markup).toContain("storyline-stream__forecast-toggle-model");
    expect(markup).not.toContain("storyline-forecast__chart-shell");
  });
});
