from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException

from app.configs.settings import (
    AIR_QUALITY_API_URL,
    GEOCODING_API_URL,
    NASA_POWER_API_URL,
)
from app.models.schemas import (
    CurrentAirQuality,
    DailyAirQualityForecast,
    LocationDashboardResponse,
    NasaWeatherContext,
    PlaceResult,
)
from app.utils.http_client import fetch_json


def search_places(name: str) -> List[PlaceResult]:
    payload = fetch_json(
        GEOCODING_API_URL,
        {"name": name, "count": 8, "language": "en", "format": "json"},
    )
    results = payload.get("results") or []
    if not isinstance(results, list):
        raise HTTPException(status_code=502, detail="Location search returned invalid results.")

    places: List[PlaceResult] = []
    for item in results:
        try:
            places.append(
                PlaceResult(
                    id=item["id"],
                    name=item["name"],
                    latitude=item["latitude"],
                    longitude=item["longitude"],
                    country=item["country"],
                    country_code=item["country_code"],
                    admin1=item.get("admin1"),
                    timezone=item.get("timezone"),
                )
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="Location search returned an invalid place record.",
            ) from exc
    return places


def _nasa_latest_weather(
    latitude: float, longitude: float
) -> Optional[NasaWeatherContext]:
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=10)
    payload = fetch_json(
        NASA_POWER_API_URL,
        {
            "parameters": "T2M,RH2M,WS10M,PRECTOTCORR",
            "community": "RE",
            "longitude": longitude,
            "latitude": latitude,
            "start": start_date.strftime("%Y%m%d"),
            "end": end_date.strftime("%Y%m%d"),
            "format": "JSON",
            "time-standard": "UTC",
        },
    )
    try:
        parameters = payload["properties"]["parameter"]
    except (KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="NASA POWER returned an invalid weather response.",
        ) from exc
    if not isinstance(parameters, dict):
        raise HTTPException(
            status_code=502,
            detail="NASA POWER returned invalid weather parameters.",
        )

    temperature = parameters.get("T2M", {})
    if not isinstance(temperature, dict):
        raise HTTPException(
            status_code=502,
            detail="NASA POWER returned invalid temperature data.",
        )
    dates = sorted(
        (
            date
            for date, value in temperature.items()
            if isinstance(value, (int, float)) and value != -999
        ),
        reverse=True,
    )
    if not dates:
        return None

    latest_date = dates[0]

    def value_for(parameter: str) -> Optional[float]:
        values = parameters.get(parameter, {})
        if not isinstance(values, dict):
            return None
        value = values.get(latest_date)
        if not isinstance(value, (int, float)) or value == -999:
            return None
        return float(value)

    return NasaWeatherContext(
        date=datetime.strptime(latest_date, "%Y%m%d").date().isoformat(),
        temperature_c=value_for("T2M"),
        humidity_percent=value_for("RH2M"),
        wind_speed_m_s=value_for("WS10M"),
        precipitation_mm=value_for("PRECTOTCORR"),
    )


def get_location_dashboard(
    latitude: float,
    longitude: float,
    name: str,
    country: str,
    country_code: str,
    admin1: Optional[str],
    place_id: int,
) -> LocationDashboardResponse:
    location = PlaceResult(
        id=place_id,
        name=name,
        latitude=latitude,
        longitude=longitude,
        country=country,
        country_code=country_code,
        admin1=admin1,
    )
    air_quality = fetch_json(
        AIR_QUALITY_API_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": "us_aqi,pm2_5,pm10",
            "hourly": "us_aqi,pm2_5,pm10",
            "forecast_days": 5,
            "timezone": "auto",
        },
    )
    try:
        current_data = air_quality["current"]
        hourly_data = air_quality["hourly"]
        times = hourly_data["time"]
        hourly_aqi = hourly_data["us_aqi"]
    except (KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="The air-quality service returned an incomplete forecast.",
        ) from exc
    if (
        not isinstance(current_data, dict)
        or not isinstance(times, list)
        or not isinstance(hourly_aqi, list)
    ):
        raise HTTPException(
            status_code=502,
            detail="The air-quality service returned invalid forecast data.",
        )
    if len(times) != len(hourly_aqi):
        raise HTTPException(
            status_code=502,
            detail="The air-quality service returned mismatched hourly data.",
        )
    current_time = current_data.get("time")
    if not isinstance(current_time, str):
        raise HTTPException(
            status_code=502,
            detail="The air-quality service did not return a current timestamp.",
        )

    daily_values: dict[str, List[float]] = {}
    for timestamp, value in zip(times, hourly_aqi):
        if (
            isinstance(timestamp, str)
            and timestamp > current_time
            and isinstance(value, (int, float))
        ):
            daily_values.setdefault(timestamp[:10], []).append(float(value))
    forecast = [
        DailyAirQualityForecast(
            date=date,
            value=round(sum(values) / len(values), 1),
            minimum=round(min(values), 1),
            maximum=round(max(values), 1),
        )
        for date, values in sorted(daily_values.items())[:5]
    ]
    if not forecast:
        raise HTTPException(
            status_code=502,
            detail="No future air-quality forecast is currently available for this location.",
        )
    try:
        current = CurrentAirQuality(
            time=current_time,
            us_aqi=current_data.get("us_aqi"),
            pm2_5=current_data.get("pm2_5"),
            pm10=current_data.get("pm10"),
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="The air-quality service returned invalid current values.",
        ) from exc

    location_timezone = air_quality.get("timezone")
    if not isinstance(location_timezone, str):
        raise HTTPException(
            status_code=502,
            detail="The air-quality service did not return a timezone.",
        )
    nasa_weather = None
    nasa_error = None
    try:
        nasa_weather = _nasa_latest_weather(latitude, longitude)
    except HTTPException as exc:
        nasa_error = str(exc.detail)

    location.timezone = location_timezone
    return LocationDashboardResponse(
        location=location,
        timezone=location_timezone,
        current=current,
        forecast=forecast,
        nasa_weather=nasa_weather,
        nasa_error=nasa_error,
    )
