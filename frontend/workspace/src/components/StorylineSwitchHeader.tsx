import { useMemo } from "react";
import type { PublishedBundle } from "../loader/publishedTypes";
import { STREAM_COLORS } from "../presentation/workspaceChrome";

interface StorylineSwitchHeaderProps {
  storylines: PublishedBundle["stream"]["storylines"];
  activeStorylineId: string | null;
  onStorylineSelect: (storylineId: string) => void;
  eyebrow?: string;
  title?: string;
  description?: string | null;
}

export function StorylineSwitchHeader({
  storylines,
  activeStorylineId,
  onStorylineSelect,
  eyebrow = "\u4e3b\u7ebf\u5207\u6362",
  title = "\u4e3b\u7ebf\u7126\u70b9",
  description = null
}: StorylineSwitchHeaderProps) {
  const sortedStorylines = useMemo(
    () => [...storylines].sort((left, right) => left.display_rank - right.display_rank),
    [storylines]
  );

  return (
    <div className="storyline-stream__header storyline-switcher">
      <div className="storyline-switcher__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="storyline-switcher__title">{title}</h2>
        {description ? <p className="muted storyline-switcher__description">{description}</p> : null}
      </div>

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
