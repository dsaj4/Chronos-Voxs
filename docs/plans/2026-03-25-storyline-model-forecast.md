# Storyline Model Forecast Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recreate the new frontend's integrated "model forecast" capability inside the local storyline workspace with pixel-level layout parity, without reviving a standalone model tab.

**Architecture:** Port the remote client-side model calculation engine and the lower-half forecast visualization into the local `StorylinePanel`, while keeping the local `PublishedBundle` as the source of storyline snapshots, available models, and published reasoning text. Add lightweight model-parameter state to the local workspace reducer and expose controls only when the active view is `storylines`. The forecast control panel must reuse the current detail-rail shell dimensions and placement, then replace that rail visually when forecast mode is active instead of stacking beneath it.

**Tech Stack:** React 19, TypeScript, Recharts, reducer-based workspace state, published bundle loader/helpers.

---

## Recommended Scope

Use **capability parity plus pixel-level shell/layout parity**.

- Keep the current local workspace shell and hidden relationship view behavior.
- Rebuild the **storyline view** to match the new remote behavior:
  - top stream chart remains the primary visual
  - lower collapsible model forecast section appears inside the storyline page
  - storylines-only model controls occupy the same slot, size, border language, and spacing as the current detail rail
- Do **not** restore the standalone remote `ModelView`.
- Do **not** touch relationship/evidence chart behavior in this round.

This gives us the new remote "模型预测" experience without undoing the shell simplifications we already made locally.

### Task 0: Create A Pixel-Parity Layout Mapping

**Files:**
- Create: `E:\Project\Cronos-Vox\docs\plans\2026-03-25-storyline-model-forecast-layout-map.md`
- Reference: `E:\Project\chronos-vox-frontend\client\src\components\views\StorylinesView.tsx`
- Reference: `E:\Project\chronos-vox-frontend\client\src\components\workspace\ModelPanel.tsx`
- Reference: `E:\Project\chronos-vox-frontend\client\src\pages\WorkspacePage.tsx`

**Step 1: Record the remote visual baseline**

Map the remote storyline page into measurable layout tokens:

- top header height
- stream chart height
- forecast section height
- forecast toggle placement
- right rail width
- right rail inner padding
- section header spacing
- chart margins

**Step 2: Map each remote block to the local target**

Document one-to-one ownership for:

- remote `StorylinesView` top header
- remote `StorylinesView` forecast section
- remote `ModelPanel`
- local `StorylinePanel`
- local `StorylineForecastSection`
- local replacement right rail

**Step 3: Treat the map as an acceptance checklist**

Implementation is not done until the local layout visually matches the remote baseline at desktop width, with only contract-driven text differences allowed.

### Task 1: Extend Local Workspace Model State

**Files:**
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\state\focusState.ts`
- Test: `E:\Project\Cronos-Vox\frontend\workspace\src\state\focusState.test.ts`
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\app\WorkspaceApp.tsx`
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\views\WorkspaceShell.tsx`

**Step 1: Add storylines-only model interaction state**

Add the minimum state required for the remote capability:

- `modelParams`
  - `bass_diffusion`
  - `gompertz`
- `appliedModelParams`
- `savedParamPresets`

Keep `selectedModelId` as the existing model switch source of truth.

**Step 2: Add reducer actions**

Add actions for:

- updating one model's params
- applying params to the local workspace
- resetting params to defaults
- saving a preset
- deleting a preset
- loading a preset

Do not add a new primary view key.

**Step 3: Wire callbacks through app shell**

Pass the new handlers from `WorkspaceApp` into `WorkspaceShell`, then down into the storyline-only model controls.

**Step 4: Verify reducer behavior**

Cover:

- default params are initialized
- switching models preserves the right param set
- preset save/load works
- reset clears applied overrides

### Task 2: Port the Remote Model Calculation Engine

**Files:**
- Create: `E:\Project\Cronos-Vox\frontend\workspace\src\forecast\modelCalculations.ts`
- Test: `E:\Project\Cronos-Vox\frontend\workspace\src\forecast\modelCalculations.test.ts`

**Step 1: Port the reusable model primitives**

Bring over the remote logic needed by storyline forecast rendering:

- Bass params/defaults/ranges
- Gompertz params/defaults/ranges
- fit quality helpers
- confidence interval helpers
- `runModel`

**Step 2: Keep the port local-contract friendly**

Inputs should use local published snapshot shape:

- `bucket_index`
- `storyline_heat_index`

Do not depend on the remote repo's context/provider types.

**Step 3: Add deterministic tests**

Cover:

- empty history returns empty forecast
- Bass/Gompertz produce historical fit and forecast arrays
- confidence bounds wrap forecast values
- fit quality numbers are stable enough for assertions

### Task 3: Build a Storyline Forecast View-Model Layer

**Files:**
- Create: `E:\Project\Cronos-Vox\frontend\workspace\src\views\storylineModelForecast.ts`
- Test: `E:\Project\Cronos-Vox\frontend\workspace\src\views\storylineModelForecast.test.ts`
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\forecast\seriesModels.ts`

**Step 1: Create a dedicated derivation helper**

Derive the lower forecast panel data from:

- active storyline snapshots
- selected model id
- effective params
- published forecast/reasoning fallbacks

**Step 2: Normalize the chart payload**

Return one structure that includes:

- historical actual line
- fitted line
- forecast line
- confidence band
- delta heat bar values
- split marker between history and forecast
- fit quality summary

**Step 3: Keep published bundle data in the loop**

Use local `bundle.stream.forecast_series` and `bundle.reasoning.model_reasoning` for:

- empty-state fallback
- explanation copy
- confidence note / comparison note

Client-side model output should drive the visualized forecast when params are active.

### Task 4: Refactor the Storyline View to Match Remote Model Forecast Behavior

**Files:**
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\views\StorylinePanel.tsx`
- Create: `E:\Project\Cronos-Vox\frontend\workspace\src\views\StorylineForecastSection.tsx`
- Test: `E:\Project\Cronos-Vox\frontend\workspace\src\views\StorylinePanel.test.tsx`

**Step 1: Keep the current top stream chart**

Preserve the existing local stream chart, storyline switch header, and chart click behavior.

**Step 2: Add the remote forecast toggle**

Add a compact `模型预测` toggle in the storyline header that expands/collapses the lower section.

**Step 3: Add the lower forecast section**

Mirror the new remote storyline experience:

- model forecast header
- fit quality metrics
- fitted line
- forecast segment
- confidence interval band
- split marker between history and forecast
- delta heat mini bar chart

**Step 4: Keep the main chart dominant**

The upper stream chart must remain visually primary. The lower section should feel secondary and collapsible, not equal-weight.

**Step 5: Add rendering tests**

Assert:

- toggle exists
- lower forecast section renders when enabled
- forecast section includes chart markers/labels
- empty storyline/history falls back cleanly

### Task 5: Replace The Detail Rail With A Forecast Rail Overlay

**Files:**
- Create: `E:\Project\Cronos-Vox\frontend\workspace\src\views\StorylineModelPanel.tsx`
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\views\DetailPanel.tsx`
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\views\WorkspaceShell.tsx`
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\styles.css`

**Step 1: Keep the current detail rail footprint**

Do not add a new global primary view. Do not reintroduce the old remote model tab.

**Step 2: Replace, do not append**

When `activePrimaryView === "storylines"` and forecast mode is inactive:

- render the existing detail rail as today

When `activePrimaryView === "storylines"` and forecast mode is active:

- hide the detail content
- render a forecast/model rail in the exact same shell position
- keep the same width, edge alignment, border treatment, top/bottom anchoring, and inner padding rhythm as the detail rail

When not on storylines:

- render the existing detail rail only

This is an overlay-style replacement, not a second panel.

**Step 3: Port the useful remote controls**

Include:

- model switch
- parameter sliders
- apply/reset
- save/load/delete preset

Skip remote-only controls that are not currently used by the integrated storyline view if they add complexity without visible value.

**Step 4: Keep impact text and model selection coherent**

Changing the model or applying params should update `lastInteractionImpact` so the top bar and detail summaries stay consistent.

**Step 5: Match the remote rail visually**

The replacement forecast rail must mirror the remote model panel's:

- section ordering
- button density
- slider spacing
- footer action area
- visual hierarchy between apply/reset/presets

### Task 6: Align Styling to the New Remote Storyline Experience

**Files:**
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\styles.css`

**Step 1: Add forecast-section styling**

Add styles for:

- storyline forecast toggle
- lower forecast header
- fit quality pills
- forecast chart container
- delta bar strip

**Step 2: Add replacement-rail styling**

Add styles for:

- param slider rows
- preset list
- apply/reset buttons
- replacement forecast rail shell
- replacement forecast rail header/body/footer

**Step 3: Protect stage balance**

Keep the current storyline main chart readable at desktop width. Avoid letting the right rail dominate the page.

**Step 4: Pixel-match the remote spacing**

Match the remote storyline view at desktop width for:

- rail width
- header paddings
- block-to-block gaps
- chart-to-divider spacing
- footer button heights
- radius and border weights

### Task 7: Add Regression Coverage for the New Capability

**Files:**
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\test\createPublishedBundleFixture.ts`
- Modify: `E:\Project\Cronos-Vox\frontend\workspace\src\views\WorkspaceShell.test.tsx`
- Test: `E:\Project\Cronos-Vox\frontend\workspace\src\views\StorylinePanel.test.tsx`
- Test: `E:\Project\Cronos-Vox\frontend\workspace\src\views\storylineModelForecast.test.ts`

**Step 1: Ensure fixture data supports both models**

Make sure the fixture includes enough historical buckets and forecast series for:

- Bass
- Gompertz
- at least one sparse/edge case storyline

**Step 2: Add shell-level behavior tests**

Cover:

- replacement forecast rail appears only on storylines
- evidence view does not render the model controls
- hidden relationship view remains hidden

**Step 3: Add storyline forecast tests**

Cover:

- expanding/collapsing the model forecast section
- switching selected model updates the rendered model label
- applying params updates the derived forecast payload

### Task 8: Verify End-to-End and Visual Behavior

**Files:**
- No source changes

**Step 1: Static verification**

Run:

- `npm.cmd run check`
- `npm.cmd run test`
- `npm.cmd run build`

**Step 2: Desktop runtime verification**

Run the workspace locally and verify:

- storylines page still opens by default
- upper stream chart remains the primary visual
- lower model forecast section expands/collapses cleanly
- turning forecast mode on replaces the right detail rail instead of stacking an extra block
- switching Bass/Gompertz updates the forecast panel
- applying custom params changes the forecast output
- evidence view does not show the storylines-only model controls

**Step 3: Pixel-parity screenshot verification**

Capture local screenshots and compare them against the remote `4240c20` desktop baseline for:

- storyline header
- stream chart section
- expanded forecast section
- replacement right rail

Accept only small text-content differences caused by local bundle data. Spacing, alignment, padding, and shell geometry should otherwise match.

**Step 4: Console hygiene**

Confirm there are no new Recharts layout warnings or state update warnings.

## Non-Goals For This Round

- Re-enable the hidden relationship view
- Recreate the standalone remote `ModelView`
- Rework relationship/evidence chart logic
- Change backend bundle contracts
- Push model parameter changes back to the backend
- Keep both detail rail and forecast rail visible at the same time

## Open Assumptions

- The remote reference for this work is `chronos-vox-frontend main@4240c20` on March 25, 2026.
- "复刻模型预测能力" means parity for the integrated storyline forecast experience, not restoring a separate model page.
- "像素级复刻" means the storyline view and forecast rail should visually track the remote desktop implementation, not just copy interactions.
- "预测启动后覆盖" means the model/forecast rail takes over the current detail rail slot with the same footprint, rather than rendering as an additional panel.
- Local published bundle data remains authoritative for storyline snapshots, available models, and reasoning copy; client-side model calculations are an exploratory UI layer.
