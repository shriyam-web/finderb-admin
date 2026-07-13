"use client";

import { useId, useMemo, useState } from "react";

export type AdminBarSeries = {
  key: string;
  label: string;
  color: string;
};

export type AdminBarPoint = {
  label: string;
  values: Record<string, number>;
};

type Props = {
  data: AdminBarPoint[];
  series: AdminBarSeries[];
  height?: number;
  formatValue?: (n: number) => string;
  formatTooltip?: (point: AdminBarPoint, total: number) => string;
  mode?: "grouped" | "single";
};

function niceMax(raw: number) {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const n = raw / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

export default function AdminBarChart({
  data,
  series,
  height = 220,
  formatValue = (n) => String(n),
  formatTooltip,
  mode = "grouped",
}: Props) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const { max, ticks, pad } = useMemo(() => {
    const totals = data.map((d) =>
      mode === "single"
        ? Math.max(...series.map((s) => d.values[s.key] ?? 0), 0)
        : series.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0),
    );
    const peak = Math.max(...totals, 1);
    const m = niceMax(peak);
    const tickCount = 4;
    return {
      max: m,
      ticks: Array.from(
        { length: tickCount + 1 },
        (_, i) => (m * i) / tickCount,
      ),
      pad: { top: 12, right: 8, bottom: 28, left: 36 },
    };
  }, [data, series, mode]);

  const W = 640;
  const H = height;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const groupW = innerW / Math.max(data.length, 1);
  const barGap = 3;
  const barW =
    mode === "single"
      ? Math.min(36, groupW * 0.55)
      : Math.min(
          16,
          (groupW * 0.7 - barGap * (series.length - 1)) / series.length,
        );

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Bar chart"
      >
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.key}
              id={`${gid}-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="1" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.82" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid + Y labels */}
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : "3 4"}
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {formatValue(t)}
              </text>
            </g>
          );
        })}

        {data.map((point, i) => {
          const cx = pad.left + groupW * i + groupW / 2;
          const total = series.reduce(
            (sum, s) => sum + (point.values[s.key] ?? 0),
            0,
          );
          const isHover = hover === i;

          return (
            <g
              key={point.label + i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* hit area */}
              <rect
                x={pad.left + groupW * i}
                y={pad.top}
                width={groupW}
                height={innerH}
                fill="transparent"
              />

              {mode === "single"
                ? (() => {
                    const s = series[0];
                    const v = point.values[s.key] ?? 0;
                    const h = Math.max((v / max) * innerH, v > 0 ? 3 : 0);
                    const x = cx - barW / 2;
                    const y = pad.top + innerH - h;
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx={4}
                        ry={4}
                        fill={`url(#${gid}-${s.key})`}
                        opacity={hover === null || isHover ? 1 : 0.45}
                      />
                    );
                  })()
                : series.map((s, si) => {
                    const v = point.values[s.key] ?? 0;
                    const h = Math.max((v / max) * innerH, v > 0 ? 3 : 0);
                    const clusterW =
                      series.length * barW + (series.length - 1) * barGap;
                    const x = cx - clusterW / 2 + si * (barW + barGap);
                    const y = pad.top + innerH - h;
                    return (
                      <rect
                        key={s.key}
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx={3}
                        ry={3}
                        fill={`url(#${gid}-${s.key})`}
                        opacity={hover === null || isHover ? 1 : 0.4}
                      />
                    );
                  })}

              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                className={isHover ? "fill-slate-800" : "fill-slate-500"}
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {point.label}
              </text>

              {isHover && total > 0 && (
                <text
                  x={cx}
                  y={pad.top - 2}
                  textAnchor="middle"
                  className="fill-slate-700"
                  style={{ fontSize: 10, fontWeight: 700 }}
                >
                  {formatTooltip
                    ? formatTooltip(point, total)
                    : formatValue(total)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-900 mb-1">
            {data[hover].label}
          </p>
          <div className="space-y-0.5">
            {series.map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-2 text-[10px] text-slate-600 font-medium"
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ background: s.color }}
                />
                <span>{s.label}</span>
                <span className="tabular-nums text-slate-900 ml-auto pl-3">
                  {formatValue(data[hover].values[s.key] ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
