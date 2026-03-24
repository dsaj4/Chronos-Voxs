import type { PublishedStoryline } from "../loader/publishedTypes";

interface StorylineListProps {
  storylines: PublishedStoryline[];
  activeStorylineId: string | null;
  onSelect: (storylineId: string) => void;
}

export function StorylineList({ storylines, activeStorylineId, onSelect }: StorylineListProps) {
  return (
    <div className="storyline-list" role="list" aria-label="主线列表">
      {storylines.map((storyline) => {
        const isActive = storyline.storyline_id === activeStorylineId;
        return (
          <button
            key={storyline.storyline_id}
            type="button"
            className={`storyline-card ${isActive ? "storyline-card--active" : ""}`}
            onClick={() => onSelect(storyline.storyline_id)}
          >
            <div className="storyline-card__top">
              <span className={`tier tier--${storyline.display_tier}`}>{storyline.display_tier}</span>
              <span className={`status status--${storyline.logic_status}`}>{storyline.logic_status}</span>
            </div>
            <h3>{storyline.title}</h3>
            <p className="muted">{storyline.summary}</p>
            <div className="storyline-card__metrics">
              <span>{storyline.support_count} 条支持</span>
              <span>{storyline.viewpoint_count} 个观点</span>
              <span>{storyline.comment_count} 条评论</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
