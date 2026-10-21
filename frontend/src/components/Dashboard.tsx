import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  Cloud,
  Droplets,
  ExternalLink,
  MapPin,
  RefreshCw,
  Satellite,
  Search,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchLocationDashboard, getWeather, searchPlaces } from "../api/client";
import LocationAgent from "./LocationAgent";
import type {
  DailyAirQualityForecast,
  LocationDashboardResponse,
  PlaceResult,
  WeatherData,
} from "../types";

type LoadStatus = "loading" | "success" | "error";

const DEFAULT_PLACE: PlaceResult = {
  id: 1273294,
  name: "Delhi",
  latitude: 28.65195,
  longitude: 77.23149,
  country: "India",
  country_code: "IN",
  admin1: "National Capital Territory of Delhi",
  timezone: "Asia/Kolkata",
};

const aqiCategory = (aqi: number | null): { label: string; color: string; bg: string } => {
  if (aqi === null) return { label: "Unavailable", color: "text-slate-300", bg: "bg-slate-700/40 border-slate-600" };
  if (aqi <= 50) return { label: "Good", color: "text-emerald-300", bg: "bg-emerald-400/10 border-emerald-400/20" };
  if (aqi <= 100) return { label: "Moderate", color: "text-yellow-300", bg: "bg-yellow-400/10 border-yellow-400/20" };
  if (aqi <= 150) return { label: "Unhealthy for sensitive groups", color: "text-orange-300", bg: "bg-orange-400/10 border-orange-400/20" };
  if (aqi <= 200) return { label: "Unhealthy", color: "text-red-300", bg: "bg-red-400/10 border-red-400/20" };
  if (aqi <= 300) return { label: "Very unhealthy", color: "text-purple-300", bg: "bg-purple-400/10 border-purple-400/20" };
  return { label: "Hazardous", color: "text-fuchsia-300", bg: "bg-fuchsia-400/10 border-fuchsia-400/20" };
};

const formatPlace = (place: PlaceResult): string =>
  [place.name, place.admin1, place.country].filter(Boolean).join(", ");

const formatDay = (date: string, options: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
}): string => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);

const formatCurrentTime = (timestamp: string): string => {
  const [date, time] = timestamp.split("T");
  return `${new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} · ${time}`;
};

const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (!error.response) return "Could not reach the AQI API. Check that the backend is running and try again.";
    return `The request failed with status ${error.response.status}. Please try again.`;
  }
  return error instanceof Error ? error.message : "An unexpected error occurred.";
};

const StatCard: React.FC<{
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, detail, icon, color }) => (
  <div className="metric-card">
    <div className="flex items-center justify-between mb-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>{icon}</div>
    </div>
    <p className="text-3xl font-bold tracking-tight text-white tabular-nums">{value}</p>
    <p className="mt-2 text-xs text-slate-500">{detail}</p>
  </div>
);

const Dashboard: React.FC = () => {
  const [placeText, setPlaceText] = useState(formatPlace(DEFAULT_PLACE));
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(DEFAULT_PLACE);
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [data, setData] = useState<LocationDashboardResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestSequence = useRef(0);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const loadPlace = useCallback(async (place: PlaceResult, quiet = false) => {
    const sequence = ++requestSequence.current;
    if (quiet) {
      setRefreshing(true);
    } else {
      setStatus("loading");
      setErrorMessage(null);
    }

    try {
      const result = await fetchLocationDashboard(place);
      if (sequence !== requestSequence.current) return;
      setData(result);
      setSelectedPlace(place);
      setStatus("success");
      setErrorMessage(null);
    } catch (error: unknown) {
      if (sequence !== requestSequence.current) return;
      setErrorMessage(getErrorMessage(error));
      setStatus("error");
    } finally {
      if (sequence === requestSequence.current) setRefreshing(false);
    }
  }, []);

  const applyAgentData = useCallback((result: LocationDashboardResponse) => {
    requestSequence.current += 1;
    setSelectedPlace(result.location);
    setPlaceText(formatPlace(result.location));
    setData(result);
    setStatus("success");
    setErrorMessage(null);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadPlace(DEFAULT_PLACE);
  }, [loadPlace]);

  useEffect(() => {
    if (!selectedPlace) return;
    const intervalId = window.setInterval(() => {
      void loadPlace(selectedPlace, true);
    }, 30 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [loadPlace, selectedPlace]);

  // Load combined weather (NASA POWER + Open-Meteo) whenever the selected place changes.
  useEffect(() => {
    if (!selectedPlace) return;
    let active = true;
    setWeatherData(null);
    setWeatherError(null);
    getWeather(selectedPlace.latitude, selectedPlace.longitude)
      .then((result) => {
        if (active) setWeatherData(result);
      })
      .catch(() => {
        if (active) setWeatherError("Could not load weather data.");
      });
    return () => {
      active = false;
    };
  }, [selectedPlace]);

  const submitSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = placeText.trim();
    if (query.length < 2) {
      setSearchMessage("Enter at least two characters to search.");
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setSearchMessage(null);
    setSearchResults([]);
    try {
      const results = await searchPlaces(query);
      setSearchResults(results);
      if (!results.length) setSearchMessage("No places found. Try a city, town, or region name.");
    } catch (error: unknown) {
      setSearchMessage(getErrorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  const choosePlace = (place: PlaceResult) => {
    setSearchResults([]);
    setSearchMessage(null);
    setPlaceText(formatPlace(place));
    setSelectedPlace(place);
    void loadPlace(place);
  };

  const currentAqi = data?.current.us_aqi ?? null;
  const category = aqiCategory(currentAqi);
  const tomorrow = data?.forecast[0];
  const nasaWeather = data?.nasa_weather;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-900/30">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">Air Quality Explorer</h1>
              <p className="text-xs text-slate-400">Location-based air quality &amp; weather</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/5 px-3 py-1.5 text-xs text-sky-200 sm:flex">
            <Satellite className="h-3.5 w-3.5" />
            NASA POWER context
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl space-y-7 px-4 py-8 sm:px-6">
        <section className="animate-slide-up">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Global forecast
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Breathe easier with a clearer outlook.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                Explore modeled air quality for a place you choose, with NASA weather data for local context.
              </p>
            </div>
            {selectedPlace && data && (
              <button
                type="button"
                onClick={() => void loadPlace(selectedPlace, true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-200 transition hover:border-sky-500/50 hover:text-white disabled:opacity-60 sm:self-auto"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh data
              </button>
            )}
          </div>
        </section>

        <section className="glass-card p-4 sm:p-5">
          <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="place-search" className="sr-only">Search for a place</label>
            <div className="relative flex-1">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="place-search"
                value={placeText}
                onChange={(event) => {
                  setPlaceText(event.target.value);
                  setSearchMessage(null);
                  setSearchResults([]);
                }}
                disabled={searching}
                placeholder="Search a city, town, or region"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/15"
              />
            </div>
            <button type="submit" disabled={searching} className="btn-primary sm:min-w-36">
              {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? "Searching…" : "Find a place"}
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {searchResults.map((place) => (
                <button
                  type="button"
                  key={`${place.id}-${place.latitude}-${place.longitude}`}
                  onClick={() => choosePlace(place)}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3 text-left transition hover:border-sky-500/40 hover:bg-slate-800/70"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-sky-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">{place.name}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {[place.admin1, place.country].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {searchMessage && <p className="mt-3 text-sm text-amber-300">{searchMessage}</p>}
          {selectedPlace && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-sky-400" />
              Showing {formatPlace(selectedPlace)}
              {data && <span className="ml-1 text-slate-600">· {data.timezone}</span>}
            </p>
          )}
        </section>

        <LocationAgent onLocationData={applyAgentData} />

        {status === "error" && errorMessage && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Could not load location data</p>
              <p className="mt-1 text-xs text-red-200/80">{errorMessage}</p>
            </div>
            {selectedPlace && (
              <button
                type="button"
                onClick={() => void loadPlace(selectedPlace)}
                className="rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-400/20"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {status === "loading" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="glass-card h-36 animate-pulse bg-slate-900/80" />
            ))}
          </div>
        )}

        {data && status === "success" && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="metric-card relative overflow-hidden">
                <div className="pointer-events-none absolute -right-5 -top-8 h-32 w-32 rounded-full bg-sky-400/10 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Current modeled AQI</p>
                  <Activity className="h-5 w-5 text-sky-300" />
                </div>
                <p className="relative mt-4 text-4xl font-bold tracking-tight text-white tabular-nums">
                  {currentAqi === null ? "—" : Math.round(currentAqi)}
                </p>
                <div className="relative mt-3 flex items-center justify-between gap-2">
                  <span className={`aqi-badge border ${category.bg} ${category.color}`}>{category.label}</span>
                  <span className="text-[11px] text-slate-500">{formatCurrentTime(data.current.time)}</span>
                </div>
              </div>
              <StatCard
                label="Next forecast period"
                value={tomorrow ? `${Math.round(tomorrow.value)} AQI` : "—"}
                detail={tomorrow ? `${formatDay(tomorrow.date)} · daily mean` : "No forecast available"}
                icon={<Cloud className="h-5 w-5 text-indigo-300" />}
                color="bg-indigo-400/10"
              />
              <StatCard
                label="PM2.5 · modeled now"
                value={data.current.pm2_5 === null ? "—" : `${data.current.pm2_5.toFixed(1)} μg/m³`}
                detail="Fine particulate matter"
                icon={<Wind className="h-5 w-5 text-amber-300" />}
                color="bg-amber-400/10"
              />
              <StatCard
                label="PM10 · modeled now"
                value={data.current.pm10 === null ? "—" : `${data.current.pm10.toFixed(1)} μg/m³`}
                detail="Coarse particulate matter"
                icon={<Wind className="h-5 w-5 text-violet-300" />}
                color="bg-violet-400/10"
              />
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
              <div className="glass-card min-w-0 p-5">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">CAMS air-quality model</p>
                    <h3 className="mt-1 text-base font-semibold text-white">Five-day AQI outlook</h3>
                    <p className="mt-1 text-xs text-slate-500">Daily mean forecast from available hourly model values.</p>
                  </div>
                  <span className="rounded-full border border-indigo-400/20 bg-indigo-400/5 px-2.5 py-1 text-[11px] text-indigo-200">
                    US AQI · 0–500
                  </span>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.forecast} margin={{ top: 10, right: 14, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(100,116,139,0.15)" vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date: string) => formatDay(date, { month: "short", day: "numeric" })}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 500]}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        labelFormatter={(date) => formatDay(String(date))}
                        formatter={(value, name) => [
                          typeof value === "number" ? `${value.toFixed(1)} AQI` : value,
                          name === "value" ? "Daily mean" : name,
                        ]}
                        contentStyle={{
                          background: "rgba(15,23,42,0.96)",
                          border: "1px solid rgba(71,85,105,0.6)",
                          borderRadius: 12,
                          color: "#e2e8f0",
                        }}
                      />
                      {currentAqi !== null && (
                        <ReferenceLine
                          y={currentAqi}
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          label={{ value: "Modeled now", fill: "#94a3b8", fontSize: 10, position: "insideTopRight" }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="value"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#38bdf8", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#7dd3fc", strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-0.5 w-5 rounded-full bg-sky-400" />
                  Daily mean AQI
                  <span className="ml-4 h-0.5 w-5 border-t border-dashed border-slate-400" />
                  Modeled current AQI
                </div>
              </div>

              <div className="glass-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">NASA POWER</p>
                    <h3 className="mt-1 text-base font-semibold text-white">NASA POWER weather context</h3>
                  </div>
                  <Satellite className="h-5 w-5 text-sky-300" />
                </div>
                {data.nasa_error ? (
                  <p role="status" className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
                    NASA POWER could not be reached: {data.nasa_error}
                  </p>
                ) : nasaWeather ? (
                  <>
                    <p className="mt-2 text-xs text-slate-500">Latest available daily data · {formatDay(nasaWeather.date)}</p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <WeatherValue label="Temperature" value={nasaWeather.temperature_c} unit="°C" />
                      <WeatherValue label="Humidity" value={nasaWeather.humidity_percent} unit="%" />
                      <WeatherValue label="Wind speed" value={nasaWeather.wind_speed_m_s} unit="m/s" />
                      <WeatherValue label="Precipitation" value={nasaWeather.precipitation_mm} unit="mm" />
                    </div>
                  </>
                ) : (
                  <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
                    NASA POWER has no recent weather values for this location yet.
                  </p>
                )}
                <div className="mt-5 border-t border-slate-800 pt-4">
                  <p className="text-xs leading-relaxed text-slate-500">
                    NASA POWER weather data is near-real-time, not an instantaneous satellite AQI measurement. The daily dataset can arrive with a delay.
                  </p>
                  <a
                    href="https://power.larc.nasa.gov/"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200"
                  >
                    NASA POWER data <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </section>

            {/* 7-Day Weather Forecast from /api/weather */}
            <WeatherForecast data={weatherData} error={weatherError} />

            <section className="glass-card overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-4">
                <h3 className="text-sm font-semibold text-white">Daily forecast details</h3>
                <p className="mt-1 text-xs text-slate-500">Mean US AQI and range across the available hourly model values.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 text-right font-medium">Daily mean AQI</th>
                      <th className="px-5 py-3 text-right font-medium">Hourly range</th>
                      <th className="px-5 py-3 text-right font-medium">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.forecast.map((point) => (
                      <ForecastRow key={point.date} point={point} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <footer className="pb-4 text-center text-[11px] leading-relaxed text-slate-600">
          Current AQI and forecast:{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-sky-300">
            Open-Meteo
          </a>{" "}
          · CAMS air-quality data · Weather context: NASA POWER near-real-time daily data
          <br />
          <a
            href="https://confluence.ecmwf.int/display/CKB/CAMS+Regional%3A+European+air+quality+analysis+and+forecast+data+documentation"
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 hover:text-sky-300"
          >
            CAMS data attribution
          </a>
          {" · "}
          Model-based estimates are not a substitute for official local air-quality alerts.
        </footer>
      </main>
    </div>
  );
};

const WeatherValue: React.FC<{ label: string; value: number | null; unit: string }> = ({
  label,
  value,
  unit,
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-white tabular-nums">
      {value === null ? "—" : `${value.toFixed(1)} ${unit}`}
    </p>
  </div>
);

const ForecastRow: React.FC<{ point: DailyAirQualityForecast }> = ({ point }) => {
  const category = aqiCategory(point.value);
  return (
    <tr className="border-t border-slate-800/70 transition hover:bg-slate-800/30">
      <td className="px-5 py-3.5 font-medium text-slate-200">{formatDay(point.date)}</td>
      <td className="px-5 py-3.5 text-right font-semibold text-white tabular-nums">{Math.round(point.value)}</td>
      <td className="px-5 py-3.5 text-right text-slate-400 tabular-nums">
        {Math.round(point.minimum)}–{Math.round(point.maximum)}
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className={`aqi-badge border ${category.bg} ${category.color}`}>{category.label}</span>
      </td>
    </tr>
  );
};

export default Dashboard;

// ─── WeatherForecast component ──────────────────────────────────────────────

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight showers",
  81: "Moderate showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Thunderstorm w/ heavy hail",
};

const wmoDescription = (code: number | null | undefined): string =>
  code !== null && code !== undefined ? (WMO_DESCRIPTIONS[code] ?? `Code ${code}`) : "—";

const safeFmt = (val: number | null | undefined, decimals = 1): string =>
  val !== null && val !== undefined && val !== -999 ? val.toFixed(decimals) : "—";

const WeatherForecast: React.FC<{ data: WeatherData | null; error: string | null }> = ({
  data,
  error,
}) => {
  if (error) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="glass-card h-40 animate-pulse bg-slate-900/80" />
        ))}
      </div>
    );
  }

  const daily = data.forecast.daily;

  // Determine which NASA POWER observation dates are actually available
  // (value !== -999) and label them so the user knows these are past observations.
  const nasaParam = data.nasa_power.properties.parameter;
  const t2m = nasaParam["T2M"] ?? {};
  const observedDates = Object.keys(t2m)
    .filter((d) => typeof t2m[d] === "number" && t2m[d] !== -999)
    .sort();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {data.sources.weather_forecast}
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">7-Day Weather Forecast</h3>
          <p className="mt-1 text-xs text-slate-500">
            Daily high/low, precipitation probability, and wind speed.
          </p>
        </div>
        {observedDates.length > 0 && (
          <span className="rounded-full border border-sky-400/20 bg-sky-400/5 px-2.5 py-1 text-[11px] text-sky-200">
            <Satellite className="mr-1 inline h-3 w-3" />
            {data.sources.historical_weather} observations · {observedDates[0]}–{observedDates[observedDates.length - 1]}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {daily.time.map((day, idx) => {
          const tMax = daily.temperature_2m_max[idx];
          const tMin = daily.temperature_2m_min[idx];
          const precip = daily.precipitation_probability_max[idx];
          const wind = daily.wind_speed_10m_max[idx];
          const code = daily.weather_code[idx];
          const label = wmoDescription(code);
          const isRainy = typeof precip === "number" && precip >= 50;

          return (
            <article
              key={day}
              className="glass-card flex flex-col gap-2 p-4 transition hover:border-sky-500/30 hover:bg-slate-800/60"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="truncate text-xs text-slate-500" title={label}>{label}</p>
              <div className="mt-auto space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5 shrink-0 text-orange-300" />
                  <span className="text-xs text-white tabular-nums">
                    {safeFmt(tMax)}° / {safeFmt(tMin)}°C
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Droplets
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isRainy ? "text-sky-300" : "text-slate-500"
                    }`}
                  />
                  <span
                    className={`text-xs tabular-nums ${
                      isRainy ? "text-sky-200" : "text-slate-400"
                    }`}
                  >
                    {typeof precip === "number" ? `${precip}%` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
                  <span className="text-xs text-slate-400 tabular-nums">
                    {safeFmt(wind, 0)} km/h
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-600">
        Forecast: {data.sources.weather_forecast} · Historical context: {data.sources.historical_weather} near-real-time daily data
        {" · "}
        <a
          href="https://open-meteo.com/en/docs"
          target="_blank"
          rel="noreferrer"
          className="text-slate-500 hover:text-sky-300"
        >
          Open-Meteo docs
        </a>
        {" · "}
        <a
          href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/"
          target="_blank"
          rel="noreferrer"
          className="text-slate-500 hover:text-sky-300"
        >
          NASA POWER docs
        </a>
      </p>
    </section>
  );
};
