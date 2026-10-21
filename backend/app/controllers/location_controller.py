from typing import List, Optional

from app.models.schemas import LocationDashboardResponse, PlaceResult
from app.services.location_service import get_location_dashboard, search_places


def search_places_controller(name: str) -> List[PlaceResult]:
    return search_places(name)


def get_location_dashboard_controller(
    latitude: float,
    longitude: float,
    name: str,
    country: str,
    country_code: str,
    admin1: Optional[str],
    place_id: int,
) -> LocationDashboardResponse:
    return get_location_dashboard(
        latitude=latitude,
        longitude=longitude,
        name=name,
        country=country,
        country_code=country_code,
        admin1=admin1,
        place_id=place_id,
    )
