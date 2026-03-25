import { useMemo, type CSSProperties } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { StorylineSwitchHeader } from "../components/StorylineSwitchHeader";
import type { PublishedBundle } from "../loader/publishedTypes";
import { STREAM_COLORS, type StreamColor } from "../presentation/workspaceChrome";
import { StorylineForecastSection } from "./StorylineForecastSection";
import type { StorylineForecastViewModel } from "./storylineModelForecast";

interface StorylinePanelProps {
  bundle: PublishedBundle;
  activeStorylineId: string | null;
  forecastOpen: boolean;
  forecastModel: StorylineForecastViewModel | null;
  selectedModelLabel: string;
  onForecastOpenChange: (open: boolean) => void;
  onStorylineSelect: (storylineId: string) => void;
}

interface StreamChartPoint {
  bucketIndex: number;
  label: string;
  [storylineId: string]: number | string;
}

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
}

function formatStreamBucketLabel(bucketStart: string, granularity: PublishedBundle["meta"]["bucket_granularity"]) {
  if (!bucketStart) {
    return "-";
  }

  if (granularity === "hour") {
    return bucketStart.replace("T", " ").slice(5, 13);
  }

  if (granularity === "week") {
    return `W ${bucketStart.slice(5)}`;
  }

  return bucketStart.slice(5);
}

function StreamTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const total = payload.reduce((sum, item) => sum + (item.value ?? 0), 0);

  return (
    <div className="stream-tooltip">
      <div className="stream-tooltip__label">{label}</div>
      {payload
        .filter((item) => typeof item.value === "number" && item.value > 0)
        .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))
        .map((item) => {
          const value = item.value ?? 0;
          const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={String(item.dataKey)} className="stream-tooltip__row">
              <div className="stream-tooltip__name">
                <span
                  className="stream-tooltip__dot"
                  style={{ background: item.color ?? "var(--cv-focus)" }}
                  aria-hidden="true"
                />
                <span>{item.name ?? item.dataKey}</span>
              </div>
              <div className="stream-tooltip__value">
                <span>{value.toFixed(1)}</span>
                <span>{percent}%</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function ProportionBar({
  storylines,
  proportions,
  activeId,
  onSelect
}: {
  storylines: PublishedBundle["stream"]["storylines"];
  proportions: Record<string, number>;
  activeId: string | null;
  onSelect: (storylineId: string) => void;
}) {
  const total = Object.values(proportions).reduce((sum, value) => sum + value, 0);

  return (
    <div className="storyline-stream__proportion">
      <div className="storyline-stream__proportion-track" aria-hidden="true">
        {storylines.map((storyline, index) => {
          const value = proportions[storyline.storyline_id] ?? 0;
          const percent = total > 0 ? (value / total) * 100 : 100 / Math.max(1, storylines.length);
          const color = STREAM_COLORS[index % STREAM_COLORS.length];
          return (
            <span
              key={`${storyline.storyline_id}-track`}
              className="storyline-stream__proportion-segment"
              style={{
                width: `${percent}%`,
                opacity: storyline.storyline_id === activeId ? 1 : 0.58,
                background: `linear-gradient(90deg, ${color.fill}, ${color.stroke})`
              }}
            />
          );
        })}
      </div>

      <div className="storyline-stream__proportion-row">
        {storylines.map((storyline, index) => {
          const value = proportions[storyline.storyline_id] ?? 0;
          const percent = total > 0 ? (value / total) * 100 : 100 / Math.max(1, storylines.length);
          const color = STREAM_COLORS[index % STREAM_COLORS.length];
          const isActive = storyline.storyline_id === activeId;
          const accentStyle = {
            width: `${percent}%`,
            minWidth: 86,
            "--storyline-accent": color.stroke,
            "--storyline-fill": color.fill,
            background: isActive ? `${color.fill}1f` : "rgba(8, 14, 21, 0.72)"
          } as CSSProperties;
          return (
            <button
              key={storyline.storyline_id}
              type="button"
              className={`storyline-stream__proportion-button ${isActive ? "storyline-stream__proportion-button--active" : ""}`}
              style={accentStyle}
              onClick={() => onSelect(storyline.storyline_id)}
            >
              <span className="storyline-stream__proportion-inline">
                <span
                  className="storyline-stream__proportion-dot"
                  style={{ background: color.stroke }}
                  aria-hidden="true"
                />
                <span className="storyline-stream__proportion-title">{storyline.title}</span>
              </span>
              <span className="storyline-stream__proportion-share">{`${percent.toFixed(0)}%`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StorylinePanel({
  bundle,
  activeStorylineId,
  forecastOpen,
  forecastModel,
  selectedModelLabel,
  onForecastOpenChange,
  onStorylineSelect
}: StorylinePanelProps) {
  const storylines = useMemo(
    () => [...bundle.stream.storylines].sort((left, right) => left.display_rank - right.display_rank),
    [bundle]
  );

  const selectedStorylineId = activeStorylineId ?? storylines[0]?.storyline_id ?? null;
  const selectedStorylineIndex = Math.max(
    0,
    storylines.findIndex((storyline) => storyline.storyline_id === selectedStorylineId)
  );
  const selectedColor: StreamColor = STREAM_COLORS[selectedStorylineIndex % STREAM_COLORS.length];

  const chartData = useMemo<StreamChartPoint[]>(() => {
    const maxBucketIndex = Math.max(
      ...bundle.stream.storyline_snapshots.map((snapshot) => snapshot.bucket_index),
      0
    );
    const snapshotsByStoryline = new Map<string, Map<number, number>>();

    for (const storyline of storylines) {
      const storylineSnapshots = bundle.stream.storyline_snapshots.filter(
        (snapshot) => snapshot.storyline_id === storyline.storyline_id
      );
      snapshotsByStoryline.set(
        storyline.storyline_id,
        new Map(storylineSnapshots.map((snapshot) => [snapshot.bucket_index, snapshot.storyline_heat_index]))
      );
    }

    return Array.from({ length: maxBucketIndex + 1 }, (_, bucketIndex) => {
      const point: StreamChartPoint = {
        bucketIndex,
        label:
          formatStreamBucketLabel(
            bundle.stream.storyline_snapshots.find((snapshot) => snapshot.bucket_index === bucketIndex)?.bucket_start ?? "",
            bundle.meta.bucket_granularity
          ) || `T${bucketIndex}`
      };

      for (const storyline of storylines) {
        point[storyline.storyline_id] =
          snapshotsByStoryline.get(storyline.storyline_id)?.get(bucketIndex) ?? 0;
      }

      return point;
    });
  }, [bundle, storylines]);

  const latestProportions = useMemo(() => {
    const lastPoint = chartData.at(-1);
    if (!lastPoint) {
      return {};
    }

    return storylines.reduce<Record<string, number>>((current, storyline) => {
      current[storyline.storyline_id] = Number(lastPoint[storyline.storyline_id] ?? 0);
      return current;
    }, {});
  }, [chartData, storylines]);

  const peakBuckets = useMemo(() => {
    return storylines.slice(0, 2).flatMap((storyline) => {
      const snapshots = bundle.stream.storyline_snapshots.filter(
        (snapshot) => snapshot.storyline_id === storyline.storyline_id
      );
      const peak = snapshots.reduce<PublishedBundle["stream"]["storyline_snapshots"][number] | null>(
        (currentPeak, snapshot) => {
          if (!currentPeak || snapshot.storyline_heat_index > currentPeak.storyline_heat_index) {
            return snapshot;
          }
          return currentPeak;
        },
        null
      );
      return peak ? [peak.bucket_index] : [];
    });
  }, [bundle, storylines]);

  const gradients = useMemo(
    () =>
      storylines.map((storyline, index) => ({
        id: `stream-gradient-${storyline.storyline_id.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
        color: STREAM_COLORS[index % STREAM_COLORS.length]
      })),
    [storylines]
  );
  const primaryChartHeight = forecastOpen ? 360 : 520;

  if (!storylines.length) {
    return <section className="panel">{"\u5f53\u524d\u6ca1\u6709\u53ef\u6e32\u67d3\u7684\u4e3b\u7ebf\u6570\u636e\u3002"}</section>;
  }

  return (
    <section className="workspace-view storyline-stream">
      <div className="workspace-view__header">
        <div className="workspace-view__intro">
          <p className="workspace-view__kicker">{`TEMPORAL ANALYSIS`}</p>
          <h2>{`The Stream`}</h2>
          <p className="workspace-view__description">{`\u8206\u8bba\u6d41\u5149\u6c60 / \u5b8f\u89c2\u6f14\u5316\u89c6\u56fe`}</p>
        </div>

        <div className="workspace-view__controls">
          <StorylineSwitchHeader
            storylines={storylines}
            activeStorylineId={selectedStorylineId}
            onStorylineSelect={onStorylineSelect}
            eyebrow={null}
            className="storyline-switcher--inline"
          />
          <button
            type="button"
            className={`storyline-stream__forecast-toggle ${forecastOpen ? "storyline-stream__forecast-toggle--active" : ""}`}
            onClick={() => onForecastOpenChange(!forecastOpen)}
          >
            <span className="storyline-stream__forecast-toggle-dot" aria-hidden="true" />
            <span>{`\u6a21\u578b\u9884\u6d4b`}</span>
            <span className="storyline-stream__forecast-toggle-model">{selectedModelLabel}</span>
          </button>
        </div>
      </div>

      <div className="storyline-stream__stage storyline-stream__stage--forecast">
        <div
          className="storyline-stream__chart storyline-stream__chart--primary"
          style={{ height: primaryChartHeight }}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={320}>
            <AreaChart
              data={chartData}
              stackOffset="expand"
              margin={{ top: 16, right: 12, bottom: 8, left: 40 }}
              onClick={(event) => {
                const payload =
                  (event as { activePayload?: Array<{ dataKey?: string | number; value?: number }> } | undefined)
                    ?.activePayload ?? [];
                const strongest = payload.reduce<{ dataKey: string; value: number } | null>((best, item) => {
                  if (typeof item?.dataKey !== "string" || typeof item.value !== "number") {
                    return best;
                  }
                  if (!best || item.value > best.value) {
                    return { dataKey: item.dataKey, value: item.value };
                  }
                  return best;
                }, null);

                if (strongest && storylines.some((storyline) => storyline.storyline_id === strongest.dataKey)) {
                  onStorylineSelect(strongest.dataKey);
                }
              }}
            >
              <defs>
                {gradients.map(({ id, color }) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color.stroke} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={color.fill} stopOpacity={0.28} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="1 6"
                stroke="rgba(86, 204, 242, 0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(120, 140, 160, 0.72)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(86, 204, 242, 0.08)" }}
                tickLine={false}
                interval={Math.max(1, Math.floor(chartData.length / 8))}
              />
              <YAxis
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                tick={{ fill: "rgba(120, 140, 160, 0.72)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
              />
              <Tooltip
                content={<StreamTooltip />}
                cursor={{
                  stroke: "rgba(86, 204, 242, 0.2)",
                  strokeWidth: 1,
                  strokeDasharray: "4 3"
                }}
              />
              {[...new Set(peakBuckets)].map((bucketIndex) => {
                const point = chartData.find((item) => item.bucketIndex === bucketIndex);
                if (!point) {
                  return null;
                }
                return (
                  <ReferenceLine
                    key={`peak-${bucketIndex}`}
                    x={point.label}
                    stroke="rgba(242, 201, 76, 0.35)"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                );
              })}
              {[...storylines].reverse().map((storyline) => {
                const gradient = gradients.find(({ id }) =>
                  id.includes(storyline.storyline_id.replace(/[^a-z0-9]/gi, "").toLowerCase())
                );
                const color: StreamColor =
                  STREAM_COLORS[
                    storylines.findIndex((item) => item.storyline_id === storyline.storyline_id) %
                      STREAM_COLORS.length
                  ];
                const isActive = storyline.storyline_id === selectedStorylineId;
                return (
                  <Area
                    key={storyline.storyline_id}
                    type="monotone"
                    dataKey={storyline.storyline_id}
                    stackId="stream"
                    stroke={color.stroke}
                    strokeWidth={isActive ? 2 : 1}
                    strokeOpacity={isActive ? 1 : 0.48}
                    fill={`url(#${gradient?.id ?? ""})`}
                    fillOpacity={1}
                    activeDot={
                      isActive
                        ? {
                            r: 4,
                            fill: color.stroke,
                            stroke: "var(--cv-bg)",
                            strokeWidth: 2
                          }
                        : false
                    }
                    name={storyline.title}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {forecastOpen && forecastModel ? (
          <StorylineForecastSection model={forecastModel} color={selectedColor} />
        ) : null}
      </div>

      <ProportionBar
        storylines={storylines}
        proportions={latestProportions}
        activeId={selectedStorylineId}
        onSelect={onStorylineSelect}
      />
    </section>
  );
}
