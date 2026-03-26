import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import {
  loadPublishedBundle,
  resolvePublishedBundleUrl,
  resolveWorkspaceSessionUrl
} from "./bundleLoader";

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

describe("resolveWorkspaceSessionUrl", () => {
  it("returns null when no workspace override is provided", () => {
    expect(resolveWorkspaceSessionUrl("")).toBeNull();
  });

  it("uses the workspace query parameter to load a workspace session first", () => {
    expect(resolveWorkspaceSessionUrl("?workspace=/ingest/workspaces/workspace_real.json")).toBe(
      "/ingest/workspaces/workspace_real.json"
    );
  });
});

describe("loadPublishedBundle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves a workspace session into its bundle URI before loading the bundle", async () => {
    const bundle = createPublishedBundleFixture();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workspace_id: "workspace_real",
            analysis_id: "analysis_real",
            bundle_uri: "/ingest/bundles/workspace_real.json",
            default_primary_view: "storylines",
            created_at: "2026-03-25T10:00:00+08:00"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(bundle), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await loadPublishedBundle(undefined, "?workspace=/ingest/workspaces/workspace_real.json");

    expect(loaded.meta.case_id).toBe(bundle.meta.case_id);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/ingest/workspaces/workspace_real.json");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/ingest/bundles/workspace_real.json");
  });
});
