import React from "react";
import {
  Activity,
  Wifi,
  WifiOff,
  Wind,
  CloudRain,
  Thermometer,
} from "lucide-react";
import type { HealthResponse } from "../types";

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
}

const Header: React.FC<HeaderProps> = ({ health, healthLoading }) => {
  const isHealthy = health?.status === "healthy";

  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 shadow-xl">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
          <Activity className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">
            AQI &amp; Weather Forecaster
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Prophet · SARIMAX · 7–14 Day Horizon
          </p>
        </div>
      </div>

      {/* Centre tags */}
      <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
          <Thermometer className="w-3.5 h-3.5 text-orange-400" />
          Temperature
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
          <Wind className="w-3.5 h-3.5 text-sky-400" />
          Wind
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
          <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
          Precipitation
        </span>
      </div>

      {/* Status chip */}
      <div className="flex items-center gap-2">
        {healthLoading ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Connecting…
          </span>
        ) : isHealthy ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
            <Wifi className="w-3.5 h-3.5" />
            API Online · {health?.data_points.toLocaleString()} pts
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            <WifiOff className="w-3.5 h-3.5" />
            API Offline
          </span>
        )}
      </div>
    </header>
  );
};

export default Header;
