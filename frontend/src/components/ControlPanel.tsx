import React from "react";
import {
  RefreshCw,
  TrendingUp,
  Calendar,
  Cpu,
  ChevronDown,
} from "lucide-react";
import type { TargetVariable, ModelType, ForecastHorizon, FetchStatus } from "../types";

interface ControlPanelProps {
  target: TargetVariable;
  model: ModelType;
  horizon: ForecastHorizon;
  status: FetchStatus;
  onTargetChange: (v: TargetVariable) => void;
  onModelChange: (v: ModelType) => void;
  onHorizonChange: (v: ForecastHorizon) => void;
  onFetch: () => void;
}

const SelectWrapper: React.FC<{
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-widest">
      {icon}
      {label}
    </label>
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
    </div>
  </div>
);

const ControlPanel: React.FC<ControlPanelProps> = ({
  target,
  model,
  horizon,
  status,
  onTargetChange,
  onModelChange,
  onHorizonChange,
  onFetch,
}) => {
  const isLoading = status === "loading";

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Cpu className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Forecast Controls</h2>
          <p className="text-xs text-slate-500">Configure model &amp; horizon</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {/* Target Variable */}
        <SelectWrapper
          label="Target"
          icon={<TrendingUp className="w-3 h-3" />}
        >
          <select
            id="select-target"
            className="select-control appearance-none pr-9"
            value={target}
            onChange={(e) => onTargetChange(e.target.value as TargetVariable)}
            disabled={isLoading}
          >
            <option value="aqi">AQI Index</option>
            <option value="temperature">Temperature (°C)</option>
            <option value="humidity">Humidity (%)</option>
          </select>
        </SelectWrapper>

        {/* Model Type */}
        <SelectWrapper label="Model" icon={<Cpu className="w-3 h-3" />}>
          <select
            id="select-model"
            className="select-control appearance-none pr-9"
            value={model}
            onChange={(e) => onModelChange(e.target.value as ModelType)}
            disabled={isLoading}
          >
            <option value="prophet">Facebook Prophet</option>
            <option value="sarimax">SARIMAX + Exog</option>
          </select>
        </SelectWrapper>

        {/* Horizon */}
        <SelectWrapper
          label="Horizon"
          icon={<Calendar className="w-3 h-3" />}
        >
          <select
            id="select-horizon"
            className="select-control appearance-none pr-9"
            value={horizon}
            onChange={(e) =>
              onHorizonChange(Number(e.target.value) as ForecastHorizon)
            }
            disabled={isLoading}
          >
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
          </select>
        </SelectWrapper>
      </div>

      <button
        id="btn-run-forecast"
        className="btn-primary w-full"
        onClick={onFetch}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Running {model === "prophet" ? "Prophet" : "SARIMAX"}…
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Run Forecast
          </>
        )}
      </button>

      {/* Model description chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {model === "prophet" ? (
          <>
            <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs">
              Weekly Seasonality
            </span>
            <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs">
              Yearly Seasonality
            </span>
            <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs">
              Multiplicative Mode
            </span>
          </>
        ) : (
          <>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs">
              Order (1,1,1)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs">
              Seasonal (1,0,1,7)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs">
              Wind · Pressure · Rain
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
