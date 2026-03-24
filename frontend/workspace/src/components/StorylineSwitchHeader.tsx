import { useMemo } from "react";
import type { PublishedBundle } from "../loader/publishedTypes";
import { STREAM_COLORS } from "../presentation/workspaceChrome";

interface StorylineSwitchHeaderProps {
  storylines: PublishedBundle["stream"]["storylines"];
  activeStorylineId: string | null;
  onStorylineSelect: (storylineId: string) => void;
  eyebrow?: string;
}

export function StorylineSwitchHeader({
  storylines,
  activeStorylineId,
  onStorylineSelect,
  eyebrow = "\u4e3b\u7ebf\u5207\u6362"
}: StorylineSwitchHeaderProps) {
  const sortedStorylines = useMemo(
    () => [...storylines].sort((left, right) => left.display_rank - right.display_rank),
    [storylines]
  );

  return (
    <div className="storyline-stream__header storyline-switcher">
      <p className="eyebrow storyline-switcher__eyebrow">{eyebrow}</p>

      <div className="storyline-stream__legend">
        {sortedStorylines.map((storyline, index) => {
          const color = STREAM_COLORS[index % STREAM_COLORS.length];
          const isActive = storyline.storyline_id === activeStorylineId;

          return (
            <button
              key={storyline.storyline_id}
              type="button"
              className={`storyline-stream__legend-item ${isActive ? "storyline-stream__legend-item--active" : ""}`}
              onClick={() => onStorylineSelect(storyline.storyline_id)}
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
