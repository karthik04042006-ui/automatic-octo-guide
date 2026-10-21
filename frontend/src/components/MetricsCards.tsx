import React from "react";
import { Wind, BarChart3, TrendingDown, Activity } from "lucide-react";
import type { ModelMetrics, HistoricalPoint, ForecastPoint, TargetVariable, FetchStatus } from "../types";

interface MetricsCardsProps {
  historical: HistoricalPoint[];
  forecast: ForecastPoint[];
  metrics: ModelMetrics | null;
  target: TargetVariable;
  status: FetchStatus;
}

const targetLabel: Record<TargetVariable, { unit: string; label: string }> = {
  aqi: { unit: "AQI", label: "Air Quality Index" },
  temperature: { unit: "°C", label: "Temperature" },
  humidity: { unit: "%", label: "Humidity" },
};

const aqiCategory = (aqi: number): { label: string; color: string; bg: string } => {
  if (aqi <= 50)  return { label: "Good",        color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" };
  if (aqi <= 100) return { label: "Moderate",    color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/20" };
  if (aqi <= 150) return { label: "Unhealthy*",  color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/20" };
  if (aqi <= 200) return { label: "Unhealthy",   color: "text-red-400",     bg: "bg-red-400/10 border-red-400/20" };
  return                 { label: "Hazardous",   color: "text-purple-400",  bg: "bg-purple-400/10 border-purple-400/20" };
};

const SkeletonCard: React.FC = () => (
  <div className="metric-card">
    <div className="skeleton h-3 w-24 mb-4" />
    <div className="skeleton h-10 w-32 mb-2" />
    <div className="skeleton h-3 w-16" />
  </div>
);

const MetricsCards: React.FC<MetricsCardsProps> = ({
  historical,
  forecast,
  metrics,
  target,
  status,
}) => {
  const isLoading = status === "loading";
  const { unit, label } = targetLabel[target];

  const currentVal = historical.length
    ? (historical[historical.length - 1] as unknown as Record<string, number>)[target]
    : null;

  const avgForecast = forecast.length
    ? forecast.reduce((s, p) => s + p.value, 0) / forecast.length
    : null;

  const aqiInfo = target === "aqi" && currentVal != null ? aqiCategory(currentVal) : null;
  const aqiFcInfo = target === "aqi" && avgForecast != null ? aqiCategory(avgForecast) : null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const cards = [
    {
      id: "card-current",
      icon: <Activity className="w-5 h-5 text-sky-400" />,
      iconBg: "bg-sky-400/10",
      label: `Current ${label}`,
      value: currentVal != null ? `${currentVal.toFixed(1)}${unit}` : "—",
      sub: aqiInfo ? (
        <span className={`aqi-badge border ${aqiInfo.bg} ${aqiInfo.color}`}>
          {aqiInfo.label}
        </span>
      ) : null,
    },
    {
      id: "card-avg-forecast",
      icon: <BarChart3 className="w-5 h-5 text-indigo-400" />,
      iconBg: "bg-indigo-400/10",
      label: `Avg Predicted ${label}`,
      value: avgForecast != null ? `${avgForecast.toFixed(1)}${unit}` : "—",
      sub: aqiFcInfo ? (
        <span className={`aqi-badge border ${aqiFcInfo.bg} ${aqiFcInfo.color}`}>
          {aqiFcInfo.label}
        </span>
      ) : null,
    },
    {
      id: "card-mae",
      icon: <TrendingDown className="w-5 h-5 text-emerald-400" />,
      iconBg: "bg-emerald-400/10",
      label: "Model MAE",
      value: metrics ? metrics.mae.toFixed(2) : "—",
      sub: <span className="text-xs text-slate-500">Mean Absolute Error</span>,
    },
    {
      id: "card-rmse",
      icon: <Wind className="w-5 h-5 text-orange-400" />,
      iconBg: "bg-orange-400/10",
      label: "Model RMSE",
      value: metrics ? metrics.rmse.toFixed(2) : "—",
      sub: <span className="text-xs text-slate-500">Root Mean Sq Error</span>,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.id} id={card.id} className="metric-card animate-fade-in">
          <div className="flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center`}>
              {card.icon}
            </div>
          </div>
          <p className="text-xs text-slate-400 font-medium mb-1">{card.label}</p>
          <p className="text-3xl font-bold text-white tracking-tight leading-none mb-2">
            {card.value}
          </p>
          {card.sub}
        </div>
      ))}
    </div>
  );
};

export default MetricsCards;
