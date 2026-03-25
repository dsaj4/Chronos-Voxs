# Storyline Model Forecast Layout Map

Remote reference: `E:\Project\chronos-vox-frontend` at `main@4240c20`

Target: local `E:\Project\Cronos-Vox\frontend\workspace`

## Shell Mapping

| Remote block | Remote source | Local target | Parity rule |
| --- | --- | --- | --- |
| Top storyline header | `client/src/components/views/StorylinesView.tsx` | `frontend/workspace/src/views/StorylinePanel.tsx` | Match top padding rhythm, kicker/title/description stack, and right-side control alignment |
| Stream chart stage | `client/src/components/views/StorylinesView.tsx` | `frontend/workspace/src/views/StorylinePanel.tsx` | Keep chart as the dominant surface with the same visual weight and chart margins |
| Forecast section | `client/src/components/views/StorylinesView.tsx` | `frontend/workspace/src/views/StorylineForecastSection.tsx` | Recreate header band, fit strip, main forecast chart, and delta strip with the same vertical proportions |
| Model panel | `client/src/components/workspace/ModelPanel.tsx` | `frontend/workspace/src/views/StorylineForecastRail.tsx` | Recreate internal hierarchy and spacing, but render inside the local detail-rail footprint |
| Right rail footprint | `client/src/pages/WorkspacePage.tsx` + local shell | `frontend/workspace/src/views/WorkspaceShell.tsx` | Keep local detail-rail slot position/edge alignment, then swap content from detail to forecast rail |

## Desktop Geometry Baseline

These are the visible layout values inferred from the remote implementation and must be preserved or mapped proportionally.

| Element | Remote value | Local rule |
| --- | --- | --- |
| Storyline page header horizontal padding | `20px` | Use `20px` in local storyline header and forecast header bands |
| Storyline page header vertical padding | `12px` top/bottom | Use `12px` in local storyline header |
| Stream chart outer left margin | `40px` | Keep `40px` in the local Recharts area chart |
| Stream chart outer right margin | `8-12px` | Use `12px` for parity with current storyline chart shell |
| Stream chart reference top gap | `12-16px` | Keep `16px` top chart margin |
| Forecast header horizontal padding | `20px` | Match exactly |
| Forecast header vertical padding | `8px` | Match exactly |
| Forecast main chart height | `160px` | Match exactly |
| Delta strip total height | `64px` | Match exactly |
| Delta strip label top padding | `4px` | Keep a tight label band above the delta chart |
| Remote model panel width | `260px` | Keep local rail slot width from detail panel, but mirror remote inner padding and section spacing |
| Remote model panel inner horizontal padding | `16px` | Match exactly inside local forecast rail |
| Remote model panel section divider rhythm | `16px` blocks with `1px` dividers | Match exactly |
| Remote footer action zone | stacked buttons with `12px`-ish vertical rhythm | Match vertical density closely |

## Storyline Header Mapping

Remote structure:

1. Kicker: `TEMPORAL ANALYSIS`
2. Title: `The Stream`
3. Description
4. Storyline legend pills
5. Forecast toggle pill

Local implementation rule:

1. Keep kicker/title/description at the left.
2. Keep storyline switch pills at the right using the existing `StorylineSwitchHeader`.
3. Add the forecast toggle into the same control cluster, not below it.
4. The toggle must visually read as a sibling to the remote forecast trigger:
   - compact pill
   - icon + label
   - active state tint
   - no extra card wrapper

## Stream Chart Mapping

Remote stream stage characteristics:

- single full-width chart surface
- dark glass background with subtle top radial glow
- stacked area chart
- peak reference lines
- bottom proportion bar

Local parity rule:

- keep the existing stream chart shell
- restore the remote bottom proportion bar
- keep active storyline emphasis on the selected stream
- do not add side rails or auxiliary cards inside the storyline stage

## Forecast Section Mapping

Remote forecast section structure:

1. Thin top divider
2. Compact forecast header
3. Fit-quality badges on the right
4. Main forecast chart
5. Thin divider
6. Delta heat strip

Local parity rule:

- render the forecast section directly below the stream chart
- do not place the forecast section inside a separate card with rounded corners
- treat it as an integrated lower band of the storyline page
- preserve exact chart heights where possible

## Forecast Rail Overlay Mapping

Remote model panel characteristics:

- narrow fixed rail
- title band
- scrollable body
- section dividers
- slider-heavy content
- sticky footer actions

Local parity rule:

- use the current detail rail slot and shell treatment
- when forecast mode is on, render the forecast rail instead of the detail panel
- do not show both rails together
- keep:
  - same column position
  - same top/bottom attachment
  - same left border seam
  - same outer shell class language as the current detail panel

## Acceptance Checklist

- Storyline header left/right alignment matches the remote rhythm.
- Forecast toggle sits in the header control cluster and does not create a second row at desktop width.
- Stream chart remains the largest visible block in the page.
- Forecast section expands directly under the stream chart with remote-like vertical segmentation.
- Bottom proportion bar is restored and aligned with the remote design language.
- Turning forecast mode on replaces the current right detail rail with the forecast rail.
- The forecast rail uses the same slot and footprint as the current detail panel.
- Forecast rail inner spacing and section ordering visually match the remote model panel.
