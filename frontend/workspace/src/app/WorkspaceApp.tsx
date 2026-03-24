import { useEffect, useMemo, useReducer, useState } from "react";
import { loadPublishedBundle } from "../loader/bundleLoader";
import type { PublishedBundle } from "../loader/publishedTypes";
import { createWorkspaceState } from "./workspaceBootstrap";
import { createDefaultCameraStateByView, focusReducer, type PrimaryViewKey } from "../state/focusState";
import { resolveFocusForStoryline } from "../state/focusSelectors";
import { WorkspaceShell } from "../views/WorkspaceShell";

export function WorkspaceApp() {
  const [bundle, setBundle] = useState<PublishedBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadPublishedBundle()
      .then((payload) => {
        if (!cancelled) {
          setBundle(payload);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load the published bundle.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const initialState = useMemo(() => (bundle ? createWorkspaceState(bundle) : null), [bundle]);
  const [focus, dispatch] = useReducer(
    focusReducer,
    initialState?.focus ?? {
      activePrimaryView: "storylines",
      activeStorylineIds: [],
      activeViewpointId: null,
      activeBucketIndex: null,
      selectedModelId: "bass_diffusion",
      lastInteractionImpact: "等待加载已发布 bundle。",
      cameraStateByView: createDefaultCameraStateByView()
    }
  );

  useEffect(() => {
    if (!bundle || !initialState) {
      return;
    }
    dispatch({
      type: "sync_focus",
      storylineIds: initialState.focus.activeStorylineIds,
      viewpointId: initialState.focus.activeViewpointId,
      bucketIndex: initialState.focus.activeBucketIndex,
      message: initialState.focus.lastInteractionImpact
    });
    dispatch({
      type: "set_model",
      modelId: bundle.meta.default_model_id
    });
  }, [bundle, initialState]);

  if (error) {
    return (
      <div className="app-shell">
        <div className="error-state">
          <h1>Workspace failed to load</h1>
          <p>{error}</p>
          <p className="muted">请确认 golden forecast bundle 已放在 /public/bundles 下。</p>
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="app-shell">
        <div className="loading-state">
          <div className="loading-state__dot" />
          <p>正在加载已发布 bundle...</p>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceShell
      bundle={bundle}
      focus={focus}
      onPrimaryViewChange={(view: PrimaryViewKey) => dispatch({ type: "set_primary_view", view })}
      onStorylineSelect={(storylineId) => {
        const nextFocus = resolveFocusForStoryline(bundle, storylineId);
        dispatch({
          type: "set_storyline_focus",
          storylineIds: nextFocus.storylineIds,
          viewpointId: nextFocus.viewpointId,
          bucketIndex: nextFocus.bucketIndex,
          message: nextFocus.message
        });
      }}
      onModelChange={(modelId) => dispatch({ type: "set_model", modelId })}
    />
  );
}
