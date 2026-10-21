"""Dedicated weather endpoint combining NASA POWER context and Open-Meteo forecast."""

from fastapi import APIRouter, HTTPException, Query

import httpx

from app.services.weather_service import fetch_weather

router = APIRouter()


@router.get("/api/weather", tags=["Weather"])
async def get_weather(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
) -> dict:
    """
    Return combined weather data for the given coordinates:
    - **nasa_power**: NASA POWER near-real-time daily observations.
    - **forecast**: Open-Meteo hourly and 7-day daily weather forecast.
    """
    try:
        return await fetch_weather(latitude, longitude)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail="An upstream weather service returned an error.",
        ) from exc
    except (httpx.RequestError, ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve weather data.",
        ) from exc
