import type { PublishedBundle } from "../loader/publishedTypes";
import { createWorkspaceBootstrap } from "../loader/bundleLoader";
import { createInitialFocusState } from "../state/focusState";

export function createWorkspaceState(bundle: PublishedBundle) {
  const bootstrap = createWorkspaceBootstrap(bundle);
  const focus = createInitialFocusState(bundle);

  return {
    ...bootstrap,
    focus
  };
}
