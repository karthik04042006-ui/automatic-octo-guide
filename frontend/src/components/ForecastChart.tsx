import React, { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type {
  HistoricalPoint,
  ForecastPoint,
  TargetVariable,
  ModelType,
  FetchStatus,
} from "../types";

interface ForecastChartProps {
  historical: HistoricalPoint[];
  forecast: ForecastPoint[];
  target: TargetVariable;
  model: ModelType;
  status: FetchStatus;
}

const TARGET_META: Record<
  TargetVariable,
  { label: string; unit: string; color: string; domain: [number | "auto", number | "auto"] }
> = {
  aqi:         { label: "AQI",         unit: "",   color: "#38bdf8", domain: [0, "auto"] },
  temperature: { label: "Temp (°C)",   unit: "°C", color: "#fb923c", domain: ["auto", "auto"] },
  humidity:    { label: "Humidity (%)", unit: "%",  color: "#a78bfa", domain: [0, 100] },
};

const MODEL_COLORS: Record<ModelType, { line: string; area: string }> = {
  prophet: { line: "#6366f1", area: "rgba(99,102,241,0.12)" },
  sarimax: { line: "#10b981", area: "rgba(16,185,129,0.12)" },
};

const CustomTooltip: React.FC<{
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  unit: string;
}> = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700/60 rounded-2xl p-4 shadow-2xl backdrop-blur-xl min-w-[180px]">
      <p className="text-xs text-slate-400 mb-3 font-medium">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        entry.value != null && (
          <div key={entry.name} className="flex items-center justify-between gap-6 mb-1.5">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="text-sm font-bold" style={{ color: entry.color }}>
              {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}{unit}
            </span>
          </div>
        )
      ))}
    </div>
  );
};

const ForecastChart: React.FC<ForecastChartProps> = ({
  historical,
  forecast,
  target,
  model,
  status,
}) => {
  const meta = TARGET_META[target];
  const modelColor = MODEL_COLORS[model];
  const isLoading = status === "loading";

  // Build a unified data array: historical → forecast merged on date
  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; actual?: number; forecast?: number; lower?: number; upper?: number }>();

    historical.forEach((p) => {
      const asRecord = p as unknown as Record<string, number>;
      map.set(p.date, { date: p.date, actual: asRecord[target] });
    });

    // Find the last historical date so we can add a "bridge" point
    const lastHistDate = historical.length ? historical[historical.length - 1].date : null;
    const lastHistPoint = historical.length ? historical[historical.length - 1] as unknown as Record<string, number> : null;
    const lastHistVal  = lastHistPoint ? lastHistPoint[target] : undefined;

    forecast.forEach((p, idx) => {
      const existing = map.get(p.date);
      if (existing) {
        map.set(p.date, { ...existing, forecast: p.value, lower: p.lower, upper: p.upper });
      } else {
        // Bridge: set the first forecast point to have the last historical actual value too
        if (idx === 0 && lastHistDate) {
          map.set(lastHistDate, { ...map.get(lastHistDate)!, forecast: lastHistVal, lower: lastHistVal, upper: lastHistVal });
        }
        map.set(p.date, { date: p.date, forecast: p.value, lower: p.lower, upper: p.upper });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [historical, forecast, target]);

  // First forecast date for reference line
  const firstFcDate = forecast.length ? forecast[0].date : null;

  const tickFormatter = (d: string) => {
    const dt = new Date(d);
    return `${dt.toLocaleString("default", { month: "short" })} ${dt.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="skeleton h-4 w-40 mb-6" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="glass-card p-5 animate-fade-in">
      {/* Chart header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base font-semibold text-white">
            {meta.label} — Historical vs. Forecast
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Last 30 days of actuals + {forecast.length}-day {model === "prophet" ? "Prophet" : "SARIMAX"} projection
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-5 h-0.5 rounded-full inline-block" style={{ background: meta.color }} />
            Actual
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-5 h-0.5 border-t-2 border-dashed inline-block" style={{ borderColor: modelColor.line }} />
            Forecast
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-5 h-3 rounded-sm inline-block opacity-50" style={{ background: modelColor.area }} />
            CI Band
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={meta.color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={meta.color} stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={modelColor.line} stopOpacity={0.25} />
              <stop offset="100%" stopColor={modelColor.line} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={tickFormatter}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={meta.domain}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}${meta.unit}`}
          />

          <Tooltip content={<CustomTooltip unit={meta.unit} />} />

          {/* CI shaded area */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill={modelColor.area}
            legendType="none"
            connectNulls
            dot={false}
            activeDot={false}
            name="Upper CI"
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="#0f172a"
            legendType="none"
            connectNulls
            dot={false}
            activeDot={false}
            name="Lower CI"
          />

          {/* Actual line */}
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke={meta.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: meta.color, strokeWidth: 0 }}
            connectNulls={false}
          />

          {/* Forecast dashed line */}
          <Line
            type="monotone"
            dataKey="forecast"
            name={`${model === "prophet" ? "Prophet" : "SARIMAX"} Forecast`}
            stroke={modelColor.line}
            strokeWidth={2.5}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 5, fill: modelColor.line, strokeWidth: 0 }}
            connectNulls
          />

          {/* Forecast start reference line */}
          {firstFcDate && (
            <ReferenceLine
              x={firstFcDate}
              stroke="rgba(148,163,184,0.3)"
              strokeDasharray="4 4"
              label={{ value: "Forecast →", fill: "#64748b", fontSize: 11, position: "insideTopRight" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ForecastChart;
