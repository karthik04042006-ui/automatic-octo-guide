import httpx
from fastapi import HTTPException


def fetch_json(url: str, params: dict[str, object]) -> dict:
    try:
        response = httpx.get(url, params=params, timeout=25.0)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"An upstream data service could not be reached: {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="An upstream data service returned invalid JSON.",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=502,
            detail="An upstream data service returned an unexpected response.",
        )
    return payload
