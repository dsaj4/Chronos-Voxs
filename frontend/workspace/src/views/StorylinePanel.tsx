import { useMemo } from "react";
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

interface StorylinePanelProps {
  bundle: PublishedBundle;
  activeStorylineId: string | null;
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

export function StorylinePanel({ bundle, activeStorylineId, onStorylineSelect }: StorylinePanelProps) {
  const storylines = useMemo(
    () => [...bundle.stream.storylines].sort((left, right) => left.display_rank - right.display_rank),
    [bundle]
  );

  const selectedStorylineId = activeStorylineId ?? storylines[0]?.storyline_id ?? null;

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

  const selectedStoryline =
    storylines.find((storyline) => storyline.storyline_id === selectedStorylineId) ?? null;

  const gradients = useMemo(
    () =>
      storylines.map((storyline, index) => ({
        id: `stream-gradient-${storyline.storyline_id.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
        color: STREAM_COLORS[index % STREAM_COLORS.length]
      })),
    [storylines]
  );

  if (!storylines.length) {
    return <section className="panel">{"\u5f53\u524d\u6ca1\u6709\u53ef\u6e32\u67d3\u7684\u4e3b\u7ebf\u6570\u636e\u3002"}</section>;
  }

  return (
    <section className="panel storyline-stream">
      <StorylineSwitchHeader
        storylines={storylines}
        activeStorylineId={selectedStorylineId}
        onStorylineSelect={onStorylineSelect}
      />

      <div className="storyline-stream__stage">
        <div className="storyline-stream__chart storyline-stream__chart--primary">
          <ResponsiveContainer width="100%" height={520} minWidth={320}>
            <AreaChart
              data={chartData}
              stackOffset="expand"
              margin={{ top: 16, right: 12, bottom: 8, left: 40 }}
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
      </div>
    </section>
  );
}
