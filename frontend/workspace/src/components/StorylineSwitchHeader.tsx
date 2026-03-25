import { useMemo, type CSSProperties } from "react";
import type { PublishedBundle } from "../loader/publishedTypes";
import { STREAM_COLORS } from "../presentation/workspaceChrome";

interface StorylineSwitchHeaderProps {
  storylines: PublishedBundle["stream"]["storylines"];
  activeStorylineId: string | null;
  activeStorylineIds?: string[];
  onStorylineSelect: (storylineId: string) => void;
  eyebrow?: string | null;
  className?: string;
  selectionMode?: "single" | "multiple";
}

export function StorylineSwitchHeader({
  storylines,
  activeStorylineId,
  activeStorylineIds,
  onStorylineSelect,
  eyebrow = "\u4e3b\u7ebf\u5207\u6362",
  className = "",
  selectionMode = "single"
}: StorylineSwitchHeaderProps) {
  const sortedStorylines = useMemo(
    () => [...storylines].sort((left, right) => left.display_rank - right.display_rank),
    [storylines]
  );
  const activeIds = useMemo(
    () =>
      new Set(
        activeStorylineIds && activeStorylineIds.length > 0
          ? activeStorylineIds
          : activeStorylineId
            ? [activeStorylineId]
            : []
      ),
    [activeStorylineId, activeStorylineIds]
  );

  return (
    <div className={`storyline-stream__header storyline-switcher ${className}`.trim()}>
      {eyebrow ? <p className="eyebrow storyline-switcher__eyebrow">{eyebrow}</p> : null}

      <div className="storyline-stream__legend">
        {sortedStorylines.map((storyline, index) => {
          const color = STREAM_COLORS[index % STREAM_COLORS.length];
          const isActive = activeIds.has(storyline.storyline_id);
          const accentStyle = {
            "--storyline-accent": color.stroke,
            "--storyline-fill": color.fill
          } as CSSProperties;

          return (
            <button
              key={storyline.storyline_id}
              type="button"
              className={`storyline-stream__legend-item ${isActive ? "storyline-stream__legend-item--active" : ""}`}
              style={accentStyle}
              onClick={() => onStorylineSelect(storyline.storyline_id)}
              aria-pressed={selectionMode === "multiple" ? isActive : undefined}
            >
              <span
                className="storyline-stream__legend-dot"
                style={{ background: color.stroke }}
                aria-hidden="true"
              />
              <span>{storyline.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
