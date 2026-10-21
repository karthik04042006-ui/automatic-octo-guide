import axios from "axios";
import type {
  HealthResponse,
  HistoricalResponse,
  ForecastResponse,
  TargetVariable,
  ModelType,
  ForecastHorizon,
  LocationDashboardResponse,
  PlaceResult,
  AgentChatResponse,
  AgentHistoryMessage,
} from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL: string = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL, timeout: 120_000 });

export const fetchHealth = (): Promise<HealthResponse> =>
  api.get<HealthResponse>("/api/health").then((r) => r.data);

export const fetchHistorical = (days = 30): Promise<HistoricalResponse> =>
  api.get<HistoricalResponse>("/api/historical", { params: { days } }).then((r) => r.data);

export const fetchForecast = (
  target: TargetVariable,
  horizon: ForecastHorizon,
  model_type: ModelType
): Promise<ForecastResponse> =>
  api
    .get<ForecastResponse>("/api/forecast", {
      params: { target, horizon, model_type },
    })
    .then((r) => r.data);

export const searchPlaces = (name: string): Promise<PlaceResult[]> =>
  api.get<PlaceResult[]>("/api/places", { params: { name } }).then((r) => r.data);

export const fetchLocationDashboard = (place: PlaceResult): Promise<LocationDashboardResponse> =>
  api
    .get<LocationDashboardResponse>("/api/location", {
      params: {
        latitude: place.latitude,
        longitude: place.longitude,
        name: place.name,
        country: place.country,
        country_code: place.country_code,
        admin1: place.admin1 ?? undefined,
        place_id: place.id,
      },
    })
    .then((r) => r.data);

export const askLocationAgent = (
  message: string,
  history: AgentHistoryMessage[]
): Promise<AgentChatResponse> =>
  api
    .post<AgentChatResponse>("/api/agent/chat", { message, history })
    .then((r) => r.data);

export const getWeather = (
  latitude: number,
  longitude: number
): Promise<import("../types").WeatherData> =>
  api
    .get<import("../types").WeatherData>("/api/weather", {
      params: { latitude, longitude },
    })
    .then((r) => r.data);
