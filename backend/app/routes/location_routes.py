from typing import List, Optional

from fastapi import APIRouter, Query

from app.controllers.location_controller import (
    get_location_dashboard_controller,
    search_places_controller,
)
from app.models.schemas import LocationDashboardResponse, PlaceResult

router = APIRouter()


@router.get("/api/places", response_model=List[PlaceResult], tags=["Locations"])
def search_places(
    name: str = Query(min_length=2, max_length=100, description="City or place name"),
) -> List[PlaceResult]:
    """Search for locations using the Open-Meteo geocoding service."""
    return search_places_controller(name)


@router.get(
    "/api/location",
    response_model=LocationDashboardResponse,
    tags=["Locations"],
)
def get_location_dashboard(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    name: str = Query(min_length=1, max_length=100),
    country: str = Query(min_length=1, max_length=100),
    country_code: str = Query(min_length=2, max_length=2),
    admin1: Optional[str] = Query(default=None, max_length=100),
    place_id: int = Query(gt=0),
) -> LocationDashboardResponse:
    """Return modeled current AQI, a five-day CAMS forecast, and NASA POWER weather."""
    return get_location_dashboard_controller(
        latitude=latitude,
        longitude=longitude,
        name=name,
        country=country,
        country_code=country_code,
        admin1=admin1,
        place_id=place_id,
    )
