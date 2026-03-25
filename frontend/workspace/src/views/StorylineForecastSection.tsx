import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { StreamColor } from "../presentation/workspaceChrome";
import type { StorylineForecastViewModel } from "./storylineModelForecast";

interface StorylineForecastSectionProps {
  model: StorylineForecastViewModel;
  color: StreamColor;
}

function ForecastTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string | number }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="storyline-forecast__tooltip">
      <div className="storyline-forecast__tooltip-label">{label}</div>
      {payload
        .filter((entry) => typeof entry.value === "number")
        .map((entry) => (
          <div key={String(entry.dataKey)} className="storyline-forecast__tooltip-row">
            <span className="storyline-forecast__tooltip-name">{entry.name ?? entry.dataKey}</span>
            <span
              className="storyline-forecast__tooltip-value"
              style={{ color: entry.color ?? "var(--cv-focus)" }}
            >
              {(entry.value ?? 0).toFixed(2)}
            </span>
          </div>
        ))}
    </div>
  );
}

export function StorylineForecastSection({ model, color }: StorylineForecastSectionProps) {
  return (
    <section className="storyline-forecast">
      <div className="storyline-forecast__header">
        <div className="storyline-forecast__header-copy">
          <span className="storyline-forecast__eyebrow">{`MODEL FORECAST / ${model.modelLabel.toUpperCase()}`}</span>
          <span className="storyline-forecast__storyline">{model.storylineTitle}</span>
        </div>
        {model.fitQuality ? (
          <div className="storyline-forecast__metrics">
            <span className="storyline-forecast__quality" style={{ color: model.qualityColor }}>
              {model.qualityLabel}
            </span>
            <span className="storyline-forecast__metric">{`RMSE ${model.fitQuality.rmse.toFixed(2)}`}</span>
            <span className="storyline-forecast__metric">{`R2 ${model.fitQuality.r2.toFixed(3)}`}</span>
          </div>
        ) : null}
      </div>

      <div className="storyline-forecast__chart-shell">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={model.chartPoints} margin={{ top: 8, right: 8, bottom: 4, left: 40 }}>
            <defs>
              <linearGradient id="storyline-forecast-band" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(86, 204, 242, 0.16)" />
                <stop offset="100%" stopColor="rgba(86, 204, 242, 0.04)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="1 6" stroke="rgba(86, 204, 242, 0.04)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(120, 140, 160, 0.5)", fontSize: 9, fontFamily: "Space Grotesk" }}
              axisLine={{ stroke: "rgba(86, 204, 242, 0.06)" }}
              tickLine={false}
              interval={Math.max(1, Math.floor(model.chartPoints.length / 8))}
            />
            <YAxis
              tick={{ fill: "rgba(120, 140, 160, 0.5)", fontSize: 9, fontFamily: "Space Grotesk" }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <Tooltip content={<ForecastTooltip />} cursor={{ stroke: "rgba(86, 204, 242, 0.15)", strokeWidth: 1 }} />
            {model.splitLabel ? (
              <ReferenceLine
                x={model.splitLabel}
                stroke="rgba(86, 204, 242, 0.2)"
                strokeDasharray="4 3"
                strokeWidth={1}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="confidenceHigh"
              stroke="none"
              fill="url(#storyline-forecast-band)"
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="confidenceLow"
              stroke="none"
              fill="var(--cv-bg)"
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              type="monotoneX"
              dataKey="actual"
              name="Historical"
              stroke={color.stroke}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive
              animationDuration={600}
            />
            <Line
              type="monotoneX"
              dataKey="fitted"
              name="Fitted"
              stroke="rgba(86, 204, 242, 0.72)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls={false}
              isAnimationActive
              animationDuration={600}
            />
            <Line
              type="monotoneX"
              dataKey="forecast"
              name="Forecast"
              stroke="rgba(86, 204, 242, 0.95)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
              dot={{ r: 3, fill: "rgba(86, 204, 242, 0.6)", stroke: "var(--cv-bg)", strokeWidth: 1 }}
              connectNulls={false}
              isAnimationActive
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="storyline-forecast__delta-shell">
        <div className="storyline-forecast__delta-label">{`\u0394Heat`}</div>
        <ResponsiveContainer width="100%" height={48}>
          <ComposedChart data={model.chartPoints} margin={{ top: 0, right: 8, bottom: 0, left: 40 }}>
            <XAxis dataKey="label" hide />
            <YAxis hide />
            <Tooltip content={<ForecastTooltip />} />
            <Bar dataKey="delta" maxBarSize={12} isAnimationActive={false}>
              {model.chartPoints.map((point, index) => (
                <Cell
                  key={`${point.label}-${index}`}
                  fill={point.delta >= 0 ? "rgba(111, 207, 151, 0.72)" : "rgba(235, 87, 87, 0.72)"}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
