"""Weather service combining NASA POWER context and Open-Meteo forecasts."""

import asyncio
from datetime import date, timedelta

import httpx

NASA_POWER_URL = (
    "https://power.larc.nasa.gov/api/temporal/"
    "daily/point"
)
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def fetch_weather(latitude: float, longitude: float) -> dict[str, object]:
    """
    Fetch combined weather data for a given location.

    NASA POWER data may lag; callers should use the dates in its response rather
    than assuming every requested observation is available.
    """
    async with httpx.AsyncClient(timeout=25.0) as client:
        # NASA POWER: request the last 7 days ending 2 days ago to allow for
        # reporting delays. Actual available dates are read from the response.
        end_date = date.today() - timedelta(days=2)
        start_date = end_date - timedelta(days=6)

        nasa_params = {
            "parameters": "T2M,T2M_MAX,T2M_MIN,RH2M,WS10M,PRECTOTCORR",
            "community": "RE",
            "longitude": longitude,
            "latitude": latitude,
            "start": start_date.strftime("%Y%m%d"),
            "end": end_date.strftime("%Y%m%d"),
            "format": "JSON",
        }

        forecast_params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": (
                "temperature_2m,"
                "relative_humidity_2m,"
                "precipitation_probability,"
                "precipitation,"
                "wind_speed_10m"
            ),
            "daily": (
                "temperature_2m_max,"
                "temperature_2m_min,"
                "precipitation_probability_max,"
                "precipitation_sum,"
                "wind_speed_10m_max,"
                "weather_code"
            ),
            "forecast_days": 7,
            "timezone": "auto",
        }

        nasa_task = client.get(NASA_POWER_URL, params=nasa_params)
        forecast_task = client.get(OPEN_METEO_URL, params=forecast_params)

        nasa_response, forecast_response = await asyncio.gather(
            nasa_task, forecast_task
        )

    nasa_response.raise_for_status()
    forecast_response.raise_for_status()

    nasa_data = nasa_response.json()
    forecast_data = forecast_response.json()

    if not isinstance(nasa_data, dict):
        raise ValueError("NASA POWER returned an invalid response.")
    if not isinstance(forecast_data, dict):
        raise ValueError("Open-Meteo returned an invalid response.")
    if not isinstance(nasa_data.get("properties"), dict) or not isinstance(
        nasa_data["properties"].get("parameter"), dict
    ):
        raise ValueError("NASA POWER returned invalid daily weather data.")
    if not isinstance(forecast_data.get("daily"), dict) or not isinstance(
        forecast_data["daily"].get("time"), list
    ):
        raise ValueError("Open-Meteo returned invalid daily forecast data.")

    return {
        "location": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "sources": {
            "historical_weather": "NASA POWER",
            "weather_forecast": "Open-Meteo",
        },
        "nasa_power": nasa_data,
        "forecast": forecast_data,
    }
