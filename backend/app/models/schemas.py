from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str
    data_points: int
    last_date: str


class HistoricalPoint(BaseModel):
    date: str
    aqi: float
    temperature: float
    humidity: float
    wind_speed: float
    pressure: float
    precipitation: float


class ForecastPoint(BaseModel):
    date: str
    value: float
    lower: float
    upper: float


class ModelMetrics(BaseModel):
    mae: float
    rmse: float


class ForecastResponse(BaseModel):
    target: str
    model_type: str
    horizon: int
    forecast: List[ForecastPoint]
    metrics: ModelMetrics


class HistoricalResponse(BaseModel):
    data: List[HistoricalPoint]
    count: int


class PlaceResult(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    country: str
    country_code: str
    admin1: Optional[str] = None
    timezone: Optional[str] = None


class CurrentAirQuality(BaseModel):
    time: str
    us_aqi: Optional[float] = None
    pm2_5: Optional[float] = None
    pm10: Optional[float] = None


class DailyAirQualityForecast(BaseModel):
    date: str
    value: float
    minimum: float
    maximum: float


class NasaWeatherContext(BaseModel):
    date: str
    temperature_c: Optional[float] = None
    humidity_percent: Optional[float] = None
    wind_speed_m_s: Optional[float] = None
    precipitation_mm: Optional[float] = None


class LocationDashboardResponse(BaseModel):
    location: PlaceResult
    timezone: str
    current: CurrentAirQuality
    forecast: List[DailyAirQualityForecast]
    nasa_weather: Optional[NasaWeatherContext] = None
    nasa_error: Optional[str] = None


class AgentHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1200)
    history: List[AgentHistoryMessage] = Field(default_factory=list, max_length=12)


class AgentChatResponse(BaseModel):
    message: str
    location_data: Optional[LocationDashboardResponse] = None
    assistant_mode: Literal["openai", "guided"]
