// ─── API Response Types ────────────────────────────────────────────────────

export type TargetVariable = "aqi" | "temperature" | "humidity";
export type ModelType = "prophet" | "sarimax";
export type ForecastHorizon = 7 | 14;

// /api/health
export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  data_points: number;
  last_date: string;
}

// /api/historical
export interface HistoricalPoint {
  date: string;
  aqi: number;
  temperature: number;
  humidity: number;
  wind_speed: number;
  pressure: number;
  precipitation: number;
}

export interface HistoricalResponse {
  data: HistoricalPoint[];
  count: number;
}

// /api/forecast
export interface ForecastPoint {
  date: string;
  value: number;
  lower: number;
  upper: number;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
}

export interface ForecastResponse {
  target: TargetVariable;
  model_type: ModelType;
  horizon: ForecastHorizon;
  forecast: ForecastPoint[];
  metrics: ModelMetrics;
}

// ─── UI State Types ────────────────────────────────────────────────────────

export interface ChartDataPoint {
  date: string;
  actual?: number;
  forecast?: number;
  lower?: number;
  upper?: number;
}

export type FetchStatus = "idle" | "loading" | "success" | "error";

export interface AppState {
  target: TargetVariable;
  model: ModelType;
  horizon: ForecastHorizon;
  status: FetchStatus;
  health: HealthResponse | null;
  historical: HistoricalPoint[];
  forecastData: ForecastPoint[];
  metrics: ModelMetrics | null;
  errorMsg: string | null;
}

export interface PlaceResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1: string | null;
  timezone: string | null;
}

export interface CurrentAirQuality {
  time: string;
  us_aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
}

export interface DailyAirQualityForecast {
  date: string;
  value: number;
  minimum: number;
  maximum: number;
}

export interface NasaWeatherContext {
  date: string;
  temperature_c: number | null;
  humidity_percent: number | null;
  wind_speed_m_s: number | null;
  precipitation_mm: number | null;
}

export interface LocationDashboardResponse {
  location: PlaceResult;
  timezone: string;
  current: CurrentAirQuality;
  forecast: DailyAirQualityForecast[];
  nasa_weather: NasaWeatherContext | null;
  nasa_error: string | null;
}

export interface AgentHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentChatResponse {
  message: string;
  location_data: LocationDashboardResponse | null;
  assistant_mode: "openai" | "guided";
}

// ─── Weather Endpoint Types ────────────────────────────────────────────────

export interface WeatherData {
  location: {
    latitude: number;
    longitude: number;
  };
  sources: {
    historical_weather: string;
    weather_forecast: string;
  };
  nasa_power: {
    properties: {
      parameter: Record<string, Record<string, number>>;
    };
  };
  forecast: {
    hourly: {
      time: string[];
      temperature_2m: (number | null)[];
      relative_humidity_2m: (number | null)[];
      precipitation_probability: (number | null)[];
      precipitation: (number | null)[];
      wind_speed_10m: (number | null)[];
    };
    daily: {
      time: string[];
      temperature_2m_max: (number | null)[];
      temperature_2m_min: (number | null)[];
      precipitation_probability_max: (number | null)[];
      precipitation_sum: (number | null)[];
      wind_speed_10m_max: (number | null)[];
      weather_code: (number | null)[];
    };
  };
}
