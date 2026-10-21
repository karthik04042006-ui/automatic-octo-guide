"""Compatibility entry point for running the FastAPI application."""

from fastapi import FastAPI

from app.configs.settings import APP_DESCRIPTION, APP_TITLE, APP_VERSION
from app.middleware.cors import configure_cors
from app.routes.agent_routes import router as agent_router
from app.routes.forecast_routes import router as forecast_router
from app.routes.location_routes import router as location_router
from app.routes.weather import router as weather_router

app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
)
configure_cors(app)
app.include_router(forecast_router)
app.include_router(location_router)
app.include_router(agent_router)
app.include_router(weather_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
