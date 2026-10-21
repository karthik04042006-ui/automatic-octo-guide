import math
import warnings
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

from app.configs.settings import FEATURE_COLUMNS, HISTORICAL_DAYS, RANDOM_SEED

warnings.filterwarnings("ignore")

rng = np.random.default_rng(RANDOM_SEED)


def _sine(
    t: np.ndarray, period: float, amplitude: float, phase: float = 0.0
) -> np.ndarray:
    return amplitude * np.sin(2 * math.pi * t / period + phase)


def generate_synthetic_dataset(n_days: int = HISTORICAL_DAYS) -> pd.DataFrame:
    start_date = datetime(2022, 1, 1)
    dates = pd.date_range(start=start_date, periods=n_days, freq="D")
    t = np.arange(n_days, dtype=float)

    temp_annual = _sine(t, 365, 12.0, -math.pi / 2)
    temp_weekly = _sine(t, 7, 1.5, 0.3)
    temperature = 22 + temp_annual + temp_weekly + 0.003 * t + rng.normal(0, 1.8, n_days)

    hum_annual = _sine(t, 365, 15.0, math.pi / 2)
    hum_weekly = _sine(t, 7, 2.0, 1.1)
    humidity = 60 - 0.4 * temp_annual + hum_annual + hum_weekly + rng.normal(0, 3.5, n_days)
    humidity = np.clip(humidity, 20, 98)

    wind_annual = _sine(t, 365, 6.0, math.pi)
    wind_weekly = _sine(t, 7, 1.0, 2.0)
    wind_speed = np.clip(
        12 + wind_annual + wind_weekly + rng.gamma(shape=2.0, scale=1.5, size=n_days),
        0.5,
        50,
    )

    pressure = (
        1013
        + _sine(t, 365, 6.0, 0.5)
        + _sine(t, 7, 1.0, 0.7)
        + rng.normal(0, 2.0, n_days)
    )
    rain_prob = 0.35 + 0.20 * np.sin(2 * math.pi * t / 365 + math.pi / 2)
    rain_mask = rng.random(n_days) < rain_prob
    precipitation = np.clip(
        rain_mask * rng.exponential(scale=5.0, size=n_days), 0, 80
    )

    aqi_noise = rng.normal(0, 6.0, n_days)
    spike_mask = rng.random(n_days) < 0.04
    spikes = rng.uniform(40, 120, n_days) * spike_mask
    aqi = (
        80
        + _sine(t, 365, 30.0, -math.pi / 4)
        + _sine(t, 7, 8.0)
        + 0.008 * t
        - 1.8 * (wind_speed - 12)
        - 2.5 * precipitation
        + 0.6 * (temperature - 22)
        + aqi_noise
        + spikes
    )
    aqi = np.clip(aqi, 5, 400)

    frame = pd.DataFrame(
        {
            "timestamp": dates,
            "temperature": np.round(temperature, 2),
            "humidity": np.round(humidity, 2),
            "wind_speed": np.round(wind_speed, 2),
            "pressure": np.round(pressure, 2),
            "precipitation": np.round(precipitation, 2),
            "aqi": np.round(aqi, 2),
        }
    ).set_index("timestamp")
    frame.index.freq = "D"
    return frame


HISTORICAL_DF = generate_synthetic_dataset()


def engineer_features(frame: pd.DataFrame) -> pd.DataFrame:
    engineered = frame.copy().asfreq("D").ffill()
    for column in ("aqi", "temperature", "humidity"):
        engineered[f"{column}_lag1"] = engineered[column].shift(1)
        engineered[f"{column}_lag7"] = engineered[column].shift(7)
        engineered[f"{column}_roll7_mean"] = engineered[column].rolling(7).mean()
        engineered[f"{column}_roll7_std"] = engineered[column].rolling(7).std()
    engineered.dropna(inplace=True)
    return engineered


ENGINEERED_DF = engineer_features(HISTORICAL_DF)


def simulate_future_exog(last_date: pd.Timestamp, horizon: int) -> pd.DataFrame:
    future_dates = pd.date_range(
        start=last_date + timedelta(days=1), periods=horizon, freq="D"
    )
    rows = []
    for future_date in future_dates:
        day_of_year = future_date.day_of_year
        window = HISTORICAL_DF[
            (HISTORICAL_DF.index.day_of_year >= max(1, day_of_year - 10))
            & (HISTORICAL_DF.index.day_of_year <= min(366, day_of_year + 10))
        ]
        if window.empty:
            window = HISTORICAL_DF

        wind = float(np.clip(window["wind_speed"].mean() + rng.normal(0, 1.5), 0.5, 50))
        pressure = float(np.clip(window["pressure"].mean() + rng.normal(0, 2.0), 980, 1040))
        precipitation = float(
            np.clip(
                window["precipitation"].mean()
                + rng.exponential(1.0) * (rng.random() < 0.3),
                0,
                60,
            )
        )
        rows.append(
            {
                "wind_speed": wind,
                "pressure": pressure,
                "precipitation": precipitation,
            }
        )
    return pd.DataFrame(rows, index=future_dates)


def compute_validation_metrics(
    y_true: np.ndarray, y_pred: np.ndarray
) -> dict[str, float]:
    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(math.sqrt(mean_squared_error(y_true, y_pred))), 4),
    }


def run_prophet_pipeline(
    target: str, horizon: int
) -> tuple[pd.DataFrame, dict[str, float]]:
    from prophet import Prophet

    series = HISTORICAL_DF[[target]].copy().reset_index()
    series.columns = ["ds", "y"]
    series["ds"] = pd.to_datetime(series["ds"])
    train_df = series.iloc[:-horizon]
    validation_df = series.iloc[-horizon:]

    validation_model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        changepoint_prior_scale=0.05,
    )
    validation_model.fit(train_df)
    validation_forecast = validation_model.predict(
        validation_model.make_future_dataframe(periods=horizon)
    )
    metrics = compute_validation_metrics(
        validation_df["y"].values,
        validation_forecast["yhat"].values[-horizon:],
    )

    full_model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        changepoint_prior_scale=0.05,
    )
    full_model.fit(series)
    forecast = full_model.predict(full_model.make_future_dataframe(periods=horizon))
    forecast = forecast.tail(horizon)[["ds", "yhat", "yhat_lower", "yhat_upper"]]
    forecast = forecast.rename(
        columns={
            "ds": "date",
            "yhat": "value",
            "yhat_lower": "lower",
            "yhat_upper": "upper",
        }
    )
    forecast["date"] = forecast["date"].dt.strftime("%Y-%m-%d")
    return forecast, metrics


def run_sarimax_pipeline(
    target: str, horizon: int
) -> tuple[pd.DataFrame, dict[str, float]]:
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    endog = HISTORICAL_DF[target].astype(float)
    exog = HISTORICAL_DF[FEATURE_COLUMNS].astype(float)
    endog_train, endog_validation = endog.iloc[:-horizon], endog.iloc[-horizon:]
    exog_train, exog_validation = exog.iloc[:-horizon], exog.iloc[-horizon:]

    validation_model = SARIMAX(
        endog=endog_train,
        exog=exog_train,
        order=(1, 1, 1),
        seasonal_order=(1, 0, 1, 7),
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    validation_result = validation_model.fit(disp=False, maxiter=200)
    validation_prediction = validation_result.forecast(
        steps=horizon, exog=exog_validation
    )
    metrics = compute_validation_metrics(
        endog_validation.values, validation_prediction.values
    )

    full_model = SARIMAX(
        endog=endog,
        exog=exog,
        order=(1, 1, 1),
        seasonal_order=(1, 0, 1, 7),
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    full_result = full_model.fit(disp=False, maxiter=200)
    last_date = HISTORICAL_DF.index[-1]
    future_exog = simulate_future_exog(last_date, horizon)[FEATURE_COLUMNS]
    forecast_result = full_result.get_forecast(steps=horizon, exog=future_exog.values)
    forecast_values = forecast_result.predicted_mean
    confidence_interval = forecast_result.conf_int(alpha=0.10)
    future_dates = pd.date_range(
        start=last_date + timedelta(days=1), periods=horizon, freq="D"
    )
    forecast = pd.DataFrame(
        {
            "date": [date.strftime("%Y-%m-%d") for date in future_dates],
            "value": np.round(forecast_values.values, 2),
            "lower": np.round(confidence_interval.iloc[:, 0].values, 2),
            "upper": np.round(confidence_interval.iloc[:, 1].values, 2),
        }
    )
    return forecast, metrics
