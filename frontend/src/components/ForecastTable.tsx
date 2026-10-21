import React from "react";
import { ArrowUp, ArrowDown, Minus, TableProperties } from "lucide-react";
import type { ForecastPoint, TargetVariable } from "../types";

interface ForecastTableProps {
  forecast: ForecastPoint[];
  target: TargetVariable;
}

const TARGET_META: Record<TargetVariable, { unit: string; label: string }> = {
  aqi:         { unit: "",    label: "AQI" },
  temperature: { unit: "°C", label: "Temperature" },
  humidity:    { unit: "%",  label: "Humidity" },
};

const aqiRowColor = (val: number, target: TargetVariable): string => {
  if (target !== "aqi") return "";
  if (val <= 50)  return "border-l-emerald-400";
  if (val <= 100) return "border-l-yellow-400";
  if (val <= 150) return "border-l-orange-400";
  if (val <= 200) return "border-l-red-400";
  return "border-l-purple-500";
};

const TrendIcon: React.FC<{ current: number; prev: number | null }> = ({ current, prev }) => {
  if (prev === null) return <Minus className="w-3.5 h-3.5 text-slate-500" />;
  const diff = current - prev;
  if (Math.abs(diff) < 0.5) return <Minus className="w-3.5 h-3.5 text-slate-500" />;
  return diff > 0
    ? <ArrowUp className="w-3.5 h-3.5 text-red-400" />
    : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />;
};

const formatDate = (dateStr: string): { weekday: string; date: string } => {
  const d = new Date(dateStr);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
};

const ForecastTable: React.FC<ForecastTableProps> = ({ forecast, target }) => {
  const { unit, label } = TARGET_META[target];

  if (!forecast.length) return null;

  return (
    <div className="glass-card animate-fade-in">
      {/* Table header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <TableProperties className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Day-by-Day Forecast</h3>
          <p className="text-xs text-slate-500">{label} projections with 90 % confidence interval</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-12">
                #
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Date
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Predicted {label}
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Lower Bound
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Upper Bound
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Range
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((point, idx) => {
              const { weekday, date } = formatDate(point.date);
              const prev = idx > 0 ? forecast[idx - 1].value : null;
              const range = point.upper - point.lower;
              const rowAccent = aqiRowColor(point.value, target);

              return (
                <tr
                  key={point.date}
                  className={`border-l-2 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors duration-150 ${rowAccent || "border-l-transparent"}`}
                >
                  <td className="px-5 py-3.5 text-xs text-slate-600 font-mono">
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium">{weekday}</span>
                      <span className="text-slate-200 font-semibold text-sm">{date}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-base font-bold text-white tabular-nums">
                      {point.value.toFixed(1)}
                      <span className="text-xs text-slate-500 ml-0.5 font-normal">{unit}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-400 tabular-nums">
                    {point.lower.toFixed(1)}{unit}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-400 tabular-nums">
                    {point.upper.toFixed(1)}{unit}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-xs text-slate-500 tabular-nums">
                      ±{(range / 2).toFixed(1)}{unit}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex justify-center">
                      <TrendIcon current={point.value} prev={prev} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForecastTable;
