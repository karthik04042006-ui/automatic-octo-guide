import os

APP_TITLE = "AQI & Weather Trends Forecaster API"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "Location-based air quality and weather forecasting API"

def get_openai_api_key() -> str | None:
    return os.getenv("OPENAI_API_KEY")


def get_openai_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini")

GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search"
AIR_QUALITY_API_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
NASA_POWER_API_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

HISTORICAL_DAYS = 1095
RANDOM_SEED = 42
FEATURE_COLUMNS = ["wind_speed", "pressure", "precipitation"]

ALLOWED_ORIGINS = ["*"]
