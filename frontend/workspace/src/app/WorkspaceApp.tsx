import { useEffect, useMemo, useReducer, useState } from "react";
import { loadPublishedBundle } from "../loader/bundleLoader";
import type { PublishedBundle } from "../loader/publishedTypes";
import { resolveFocusForStoryline } from "../state/focusSelectors";
import {
  createDefaultCameraStateByView,
  createDefaultModelParamsById,
  focusReducer,
  type PrimaryViewKey
} from "../state/focusState";
import { WorkspaceShell } from "../views/WorkspaceShell";
import { createWorkspaceState } from "./workspaceBootstrap";

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
      lastInteractionImpact: "\u7b49\u5f85\u52a0\u8f7d\u5df2\u53d1\u5e03 bundle\u3002",
      cameraStateByView: createDefaultCameraStateByView(),
      modelParamsById: createDefaultModelParamsById(),
      appliedModelParamsById: null,
      savedModelPresets: []
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
          <p className="muted">{`\u8bf7\u786e\u8ba4 golden forecast bundle \u5df2\u653e\u5728 /public/bundles \u4e0b\u3002`}</p>
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="app-shell">
        <div className="loading-state">
          <div className="loading-state__dot" />
          <p>{`\u6b63\u5728\u52a0\u8f7d\u5df2\u53d1\u5e03 bundle...`}</p>
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
      onModelParamsChange={(modelId, params) => dispatch({ type: "set_model_params", modelId, params })}
      onApplyModelParams={() => dispatch({ type: "apply_model_params" })}
      onResetModelParams={() => dispatch({ type: "reset_model_params" })}
      onSaveModelPreset={(name) => dispatch({ type: "save_model_preset", name })}
      onDeleteModelPreset={(presetId) => dispatch({ type: "delete_model_preset", id: presetId })}
      onLoadModelPreset={(presetId) => dispatch({ type: "load_model_preset", id: presetId })}
    />
  );
}
