import { useMemo, useState } from "react";
import {
  BASS_PARAM_RANGES,
  GOMPERTZ_PARAM_RANGES,
  MODEL_DEFAULT_PARAMS,
  type BassParams,
  type GompertzParams
} from "../forecast/modelCalculations";
import type { ForecastModelId, PublishedBundle } from "../loader/publishedTypes";
import { getModelCategoryLabel } from "../presentation/workspaceChrome";
import type { WorkspaceFocusState } from "../state/focusState";
import type { StorylineForecastViewModel } from "./storylineModelForecast";

interface StorylineForecastRailProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  model: StorylineForecastViewModel | null;
  onModelChange: (modelId: ForecastModelId) => void;
  onModelParamsChange: (modelId: ForecastModelId, params: BassParams | GompertzParams) => void;
  onApplyModelParams: () => void;
  onResetModelParams: () => void;
  onSaveModelPreset: (name: string) => void;
  onDeleteModelPreset: (presetId: string) => void;
  onLoadModelPreset: (presetId: string) => void;
}

interface ParamSliderProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (value: number) => void;
}

function areParamsEqual(
  left: BassParams | GompertzParams | null | undefined,
  right: BassParams | GompertzParams | null | undefined
) {
  if (!left || !right) {
    return false;
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const leftRecord = left as unknown as Record<string, number>;
  const rightRecord = right as unknown as Record<string, number>;
  for (const key of keys) {
    if (Math.abs(leftRecord[key] - rightRecord[key]) > 0.0001) {
      return false;
    }
  }
  return true;
}

function ParamSlider({
  label,
  description,
  value,
  min,
  max,
  step,
  defaultValue,
  onChange
}: ParamSliderProps) {
  const progress = ((value - min) / (max - min)) * 100;
  const isModified = Math.abs(value - defaultValue) > step * 0.5;

  return (
    <div className="forecast-rail__slider">
      <div className="forecast-rail__slider-head">
        <div className="forecast-rail__slider-copy">
          <span className="forecast-rail__slider-label">{label}</span>
          <span className="forecast-rail__slider-description">{description}</span>
        </div>
        <button
          type="button"
          className={`forecast-rail__slider-value ${isModified ? "forecast-rail__slider-value--active" : ""}`}
          onClick={() => onChange(defaultValue)}
        >
          {value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 1)}
        </button>
      </div>
      <div className="forecast-rail__slider-track">
        <span className="forecast-rail__slider-fill" style={{ width: `${progress}%` }} aria-hidden="true" />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <div className="forecast-rail__slider-meta">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function StorylineForecastRail({
  bundle,
  focus,
  model,
  onModelChange,
  onModelParamsChange,
  onApplyModelParams,
  onResetModelParams,
  onSaveModelPreset,
  onDeleteModelPreset,
  onLoadModelPreset
}: StorylineForecastRailProps) {
  const [presetName, setPresetName] = useState("");
  const [showPresets, setShowPresets] = useState(true);
  const currentModelId = focus.selectedModelId;
  const currentParams = focus.modelParamsById[currentModelId];
  const appliedParams = focus.appliedModelParamsById?.[currentModelId] ?? null;
  const hasAppliedParams = focus.appliedModelParamsById !== null;
  const isAppliedState = areParamsEqual(currentParams, appliedParams);
  const modelDefinition =
    bundle.meta.available_models.find((item) => item.id === currentModelId) ?? null;
  const defaults = MODEL_DEFAULT_PARAMS[currentModelId];
  const paramRanges = currentModelId === "bass_diffusion" ? BASS_PARAM_RANGES : GOMPERTZ_PARAM_RANGES;
  const currentParamRecord = currentParams as unknown as Record<string, number>;
  const defaultParamRecord = defaults as unknown as Record<string, number>;

  const presetLabel = useMemo(() => {
    if (presetName.trim().length > 0) {
      return presetName.trim();
    }
    return `${modelDefinition?.label ?? currentModelId} ${focus.savedModelPresets.length + 1}`;
  }, [currentModelId, focus.savedModelPresets.length, modelDefinition?.label, presetName]);

  return (
    <section className="panel detail-panel detail-panel--signal forecast-rail">
      <div className="forecast-rail__header">
        <div>
          <p className="eyebrow">{`MODEL PANEL`}</p>
          <h3>{`\u9884\u6d4b\u63a7\u5236`}</h3>
        </div>
        {modelDefinition ? (
          <span className="workspace-model">
            {`${modelDefinition.label} / ${getModelCategoryLabel(modelDefinition.category)}`}
          </span>
        ) : null}
      </div>

      <div className="forecast-rail__summary-card">
        <span className="forecast-rail__summary-kicker">{`ACTIVE STORYLINE`}</span>
        <strong className="forecast-rail__summary-title">
          {model?.storylineTitle ?? `\u6682\u65e0\u4e3b\u7ebf`}
        </strong>
        {model ? (
          <div className="forecast-rail__summary-meta">
            <span style={{ color: model.qualityColor }}>{model.qualityLabel}</span>
            {model.fitQuality ? <span>{`RMSE ${model.fitQuality.rmse.toFixed(2)}`}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="forecast-rail__body">
        <div className="forecast-rail__section">
          <div className="forecast-rail__section-title">{`\u5f53\u524d\u6a21\u578b`}</div>
          <div className="forecast-rail__model-grid">
            {bundle.meta.available_models.map((availableModel) => {
              const isActive = availableModel.id === currentModelId;
              return (
                <button
                  key={availableModel.id}
                  type="button"
                  className={`forecast-rail__model-button ${isActive ? "forecast-rail__model-button--active" : ""}`}
                  onClick={() => onModelChange(availableModel.id)}
                >
                  <span className="forecast-rail__model-label">{availableModel.label}</span>
                  <span className="forecast-rail__model-meta">
                    {getModelCategoryLabel(availableModel.category)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="forecast-rail__section">
          <div className="forecast-rail__section-title">{`\u53c2\u6570\u8c03\u6574`}</div>
          <div className="forecast-rail__slider-list">
            {Object.entries(paramRanges).map(([key, range]) => (
              <ParamSlider
                key={key}
                label={range.label}
                description={range.description}
                value={currentParamRecord[key]}
                min={range.min}
                max={range.max}
                step={range.step}
                defaultValue={defaultParamRecord[key]}
                onChange={(value) =>
                  onModelParamsChange(currentModelId, {
                    ...currentParams,
                    [key]: value
                  } as BassParams | GompertzParams)
                }
              />
            ))}
          </div>
        </div>

        <div className="forecast-rail__section">
          <button
            type="button"
            className="forecast-rail__presets-toggle"
            onClick={() => setShowPresets((current) => !current)}
          >
            <span>{`\u53c2\u6570\u9884\u8bbe`}</span>
            <span>{showPresets ? "\u6536\u8d77" : "\u5c55\u5f00"}</span>
          </button>
          {showPresets ? (
            <div className="forecast-rail__preset-panel">
              <div className="forecast-rail__preset-form">
                <input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder={`\u9884\u8bbe\u540d\u79f0`}
                />
                <button
                  type="button"
                  className="forecast-rail__preset-save"
                  onClick={() => {
                    onSaveModelPreset(presetLabel);
                    setPresetName("");
                  }}
                >
                  {`\u4fdd\u5b58`}
                </button>
              </div>
              <div className="forecast-rail__preset-list">
                {focus.savedModelPresets.length === 0 ? (
                  <span className="forecast-rail__empty">{`\u6682\u65e0\u9884\u8bbe`}</span>
                ) : (
                  focus.savedModelPresets.map((preset) => (
                    <div key={preset.id} className="forecast-rail__preset-item">
                      <div className="forecast-rail__preset-copy">
                        <span className="forecast-rail__preset-name">{preset.name}</span>
                        <span className="forecast-rail__preset-meta">
                          {preset.modelId === "bass_diffusion" ? "Bass Diffusion" : "Gompertz"}
                        </span>
                      </div>
                      <div className="forecast-rail__preset-actions">
                        <button type="button" onClick={() => onLoadModelPreset(preset.id)}>
                          {`\u52a0\u8f7d`}
                        </button>
                        <button type="button" onClick={() => onDeleteModelPreset(preset.id)}>
                          {`\u5220\u9664`}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        {model ? (
          <div className="forecast-rail__section">
            <div className="forecast-rail__section-title">{`\u9884\u6d4b\u89e3\u8bfb`}</div>
            <div className="forecast-rail__reasoning-card">
              <p>{model.reasoningText}</p>
              {model.confidenceNote ? <p>{model.confidenceNote}</p> : null}
              {model.comparisonSummary ? <p>{model.comparisonSummary}</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="forecast-rail__footer">
        <button type="button" className="forecast-rail__apply" onClick={onApplyModelParams}>
          {`\u5e94\u7528\u5230\u5f53\u524d\u9884\u6d4b`}
        </button>
        <button type="button" className="forecast-rail__reset" onClick={onResetModelParams}>
          {hasAppliedParams ? `\u64a4\u9500\u5e94\u7528 / \u6062\u590d\u9ed8\u8ba4` : `\u6062\u590d\u9ed8\u8ba4`}
        </button>
        <div className={`forecast-rail__status ${isAppliedState && hasAppliedParams ? "forecast-rail__status--active" : ""}`}>
          {isAppliedState && hasAppliedParams
            ? `\u5f53\u524d\u53c2\u6570\u5df2\u751f\u6548`
            : `\u6ed1\u5757\u6539\u52a8\u4f1a\u5373\u65f6\u66f4\u65b0\u56fe\u8868`}
        </div>
      </div>
    </section>
  );
}
