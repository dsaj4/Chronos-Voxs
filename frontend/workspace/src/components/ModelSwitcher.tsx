import type { ForecastModelId, PublishedModelDefinition } from "../loader/publishedTypes";

interface ModelSwitcherProps {
  models: PublishedModelDefinition[];
  selectedModelId: ForecastModelId;
  onSelect: (modelId: ForecastModelId) => void;
}

export function ModelSwitcher({ models, selectedModelId, onSelect }: ModelSwitcherProps) {
  return (
    <div className="model-switcher" role="radiogroup" aria-label="预测模型切换器">
      {models.map((model) => {
        const isActive = model.id === selectedModelId;
        return (
          <button
            key={model.id}
            type="button"
            className={`chip ${isActive ? "chip--active" : ""}`}
            onClick={() => onSelect(model.id)}
            aria-pressed={isActive}
          >
            <span className="chip__label">{model.label}</span>
            <span className="chip__meta">{model.category === "diffusion" ? "扩散" : "饱和"}</span>
          </button>
        );
      })}
    </div>
  );
}
