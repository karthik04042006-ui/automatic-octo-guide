from typing import Literal

from fastapi import APIRouter, Query

from app.controllers.forecast_controller import (
    get_forecast_controller,
    get_historical_controller,
    health_check_controller,
)
from app.models.schemas import (
    ForecastResponse,
    HealthResponse,
    HistoricalResponse,
)

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse, tags=["System"])
def health_check() -> HealthResponse:
    """Basic liveness and readiness probe."""
    return health_check_controller()


@router.get("/api/historical", response_model=HistoricalResponse, tags=["Data"])
def get_historical(
    days: int = Query(
        default=30,
        ge=7,
        le=365,
        description="Number of recent days to return",
    ),
) -> HistoricalResponse:
    """Return the last requested rows of the synthetic historical dataset."""
    return get_historical_controller(days)


@router.get("/api/forecast", response_model=ForecastResponse, tags=["Forecasting"])
def get_forecast(
    target: Literal["aqi", "temperature", "humidity"] = Query(
        default="aqi", description="Target variable to forecast"
    ),
    horizon: int = Query(
        default=7, ge=7, le=14, description="Forecast horizon in days (7 or 14)"
    ),
    model_type: Literal["prophet", "sarimax"] = Query(
        default="prophet", description="Forecasting model to use"
    ),
) -> ForecastResponse:
    """Run the chosen model and return its forecast and validation metrics."""
    return get_forecast_controller(target, horizon, model_type)
