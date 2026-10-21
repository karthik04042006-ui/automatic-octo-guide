from typing import Literal

from fastapi import HTTPException

from app.configs.settings import APP_VERSION
from app.models.schemas import (
    ForecastPoint,
    ForecastResponse,
    HealthResponse,
    HistoricalPoint,
    HistoricalResponse,
    ModelMetrics,
)
from app.services.forecast_service import (
    HISTORICAL_DF,
    run_prophet_pipeline,
    run_sarimax_pipeline,
)


def health_check_controller() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        version=APP_VERSION,
        data_points=len(HISTORICAL_DF),
        last_date=HISTORICAL_DF.index[-1].strftime("%Y-%m-%d"),
    )


def get_historical_controller(days: int) -> HistoricalResponse:
    recent = HISTORICAL_DF.tail(days).reset_index()
    points = [
        HistoricalPoint(
            date=row["timestamp"].strftime("%Y-%m-%d"),
            aqi=float(row["aqi"]),
            temperature=float(row["temperature"]),
            humidity=float(row["humidity"]),
            wind_speed=float(row["wind_speed"]),
            pressure=float(row["pressure"]),
            precipitation=float(row["precipitation"]),
        )
        for _, row in recent.iterrows()
    ]
    return HistoricalResponse(data=points, count=len(points))


def get_forecast_controller(
    target: Literal["aqi", "temperature", "humidity"],
    horizon: int,
    model_type: Literal["prophet", "sarimax"],
) -> ForecastResponse:
    try:
        if model_type == "prophet":
            forecast_df, metrics = run_prophet_pipeline(target, horizon)
        else:
            forecast_df, metrics = run_sarimax_pipeline(target, horizon)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model error: {str(exc)}") from exc

    forecast_points = [
        ForecastPoint(
            date=str(row["date"]),
            value=float(row["value"]),
            lower=float(row["lower"]),
            upper=float(row["upper"]),
        )
        for _, row in forecast_df.iterrows()
    ]
    return ForecastResponse(
        target=target,
        model_type=model_type,
        horizon=horizon,
        forecast=forecast_points,
        metrics=ModelMetrics(mae=metrics["mae"], rmse=metrics["rmse"]),
    )
