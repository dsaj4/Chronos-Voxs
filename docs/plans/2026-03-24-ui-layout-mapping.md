# Chronos-Vox UI Layout Mapping

Reference baseline: `E:\Project\chronos-vox-frontend` at `89f4b0f`

Scope for this round:
- Recreate shell and main view layout at the component/block level.
- Do not port feature updates from remote `RelationshipsView` chart logic or `ModelView`.

| Remote UI Element | Remote Source | Local Target | Target Layout Replica |
| --- | --- | --- | --- |
| Top navigation bar | `client/src/components/workspace/TopNav.tsx` | `frontend/workspace/src/views/WorkspaceShell.tsx` | `52px` fixed top bar, `20px` horizontal padding, left brand block, centered view tabs, right aligned impact text, no floating card shell |
| Main workspace stage shell | `client/src/pages/WorkspacePage.tsx` | `frontend/workspace/src/views/WorkspaceShell.tsx` | Full-height center work area, grid-image background, dark overlay, no outer page padding, stage fills remaining viewport |
| Right detail rail | `client/src/components/workspace/DetailPanel.tsx` | `frontend/workspace/src/views/DetailPanel.tsx` | Fixed `300px` width, full-height side rail, flat edge with left divider, internal scroll only |
| Bottom status thumbnails | `client/src/components/workspace/StatusThumbnails.tsx` | `frontend/workspace/src/components/StatusThumbnails.tsx` | `72px` bottom strip, inactive views only, lightweight thumbnail cards, no deep detail copy |
| Storylines header | `client/src/components/views/StorylinesView.tsx` | `frontend/workspace/src/views/StorylinePanel.tsx` | Header integrated into view body with left title block and right inline storyline pills, bottom border separator, chart fills main body |
| Relationships header shell | `client/src/components/views/RelationshipsView.tsx` | `frontend/workspace/src/views/RelationshipPanel.tsx` | Compact header row, no detached card shell, storyline switcher moved into header control slot, stage sits immediately below legend |
| Evidence header shell | `client/src/components/views/EvidenceView.tsx` | `frontend/workspace/src/views/EvidencePanel.tsx` | Compact header row, storyline switcher integrated into header control slot, bucket strip aligned to same visual language, field fills remaining area |
| Evidence bucket controls | `client/src/components/views/EvidenceView.tsx` bucket buttons | `frontend/workspace/src/views/EvidencePanel.tsx` | Minimal pill controls with tighter height and spacing, aligned with remote compact control strip rhythm |

## Local-to-Remote Mapping Notes

| Local Element | Remote Counterpart | Action |
| --- | --- | --- |
| `workspace-header` card | `TopNav` bar | Replace floating glass card with flat top nav shell |
| Detached `StorylineSwitchHeader` row | Header-right legend/control area | Merge into each view header instead of keeping a separate strip |
| Rounded panel shell around left views | Full-height view surface | Remove card framing and let views sit directly in the stage shell |
| Deleted right-side preview cards | `StatusThumbnails` bottom strip | Reintroduce only as bottom thumbnails, not as a second detail rail |
| Current detail accordion content | Remote detail rail shell | Keep local data and accordions, but align outer width/edge treatment to remote |

## Non-goals

- Do not port remote `ModelView`, `ModelPanel`, or related modeling interactions in this pass.
- Do not replace current local relationship chart logic with the remote heatmap implementation in this pass.
