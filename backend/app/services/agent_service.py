import json
import re
from typing import List, Optional

import httpx
from fastapi import HTTPException

from app.configs.settings import (
    OPENAI_CHAT_COMPLETIONS_URL,
    get_openai_api_key,
    get_openai_model,
)
from app.models.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    LocationDashboardResponse,
    PlaceResult,
)
from app.services.location_service import get_location_dashboard, search_places
from app.utils.place_query import extract_place_query

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_places",
            "description": "Find matching real places by city, town, region, or country name. Use this before requesting AQI data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The place name the user asked about",
                    }
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_place_air_quality",
            "description": "Get live modeled AQI, a five-day forecast, particulate data, and NASA POWER weather for a place returned by search_places.",
            "parameters": {
                "type": "object",
                "properties": {
                    "place_id": {
                        "type": "integer",
                        "description": "ID of a place returned by search_places",
                    }
                },
                "required": ["place_id"],
                "additionalProperties": False,
            },
        },
    },
]


def _guided_location_response(message: str) -> AgentChatResponse:
    query = extract_place_query(message)
    if not query:
        return AgentChatResponse(
            message="Tell me the place you want, for example: “What’s the AQI in Bengaluru, India?”",
            assistant_mode="guided",
        )

    places = search_places(name=query)
    if not places:
        return AgentChatResponse(
            message=f"I couldn’t find “{query}”. Try adding its state, region, or country.",
            assistant_mode="guided",
        )

    query_tokens = set(re.findall(r"[a-z0-9]+", query.casefold()))
    if "uk" in query_tokens:
        query_tokens.discard("uk")
        query_tokens.update(("united", "kingdom"))
    if "usa" in query_tokens or "us" in query_tokens:
        query_tokens.discard("usa")
        query_tokens.discard("us")
        query_tokens.update(("united", "states"))
    query_name = query.split(",", maxsplit=1)[0].strip().casefold()

    def place_score(place: PlaceResult) -> int:
        place_tokens = set(
            re.findall(
                r"[a-z0-9]+",
                " ".join(
                    part for part in (place.name, place.admin1, place.country) if part
                ).casefold(),
            )
        )
        exact_name_bonus = 10 if place.name.casefold() == query_name else 0
        return exact_name_bonus + len(query_tokens & place_tokens)

    ranked_places = sorted(places, key=place_score, reverse=True)
    best_score = place_score(ranked_places[0])
    equally_matched = [
        place for place in ranked_places if place_score(place) == best_score
    ]
    if len(equally_matched) > 1:
        options = "; ".join(
            f"{place.name}, {', '.join(part for part in (place.admin1, place.country) if part)}"
            for place in equally_matched[:5]
        )
        return AgentChatResponse(
            message=f"I found multiple matches for “{query}”. Which one do you mean? {options}. Include the country or region in your next message.",
            assistant_mode="guided",
        )

    place = ranked_places[0]
    data = get_location_dashboard(
        latitude=place.latitude,
        longitude=place.longitude,
        name=place.name,
        country=place.country,
        country_code=place.country_code,
        admin1=place.admin1,
        place_id=place.id,
    )
    current_aqi = data.current.us_aqi
    current_summary = (
        f"Current modeled US AQI in {place.name}, {place.country} is {current_aqi:.0f} "
        f"({data.current.time} local time)."
        if current_aqi is not None
        else f"Current AQI is unavailable for {place.name}, {place.country}."
    )
    particulate = []
    if data.current.pm2_5 is not None:
        particulate.append(f"PM2.5 {data.current.pm2_5:.1f} μg/m³")
    if data.current.pm10 is not None:
        particulate.append(f"PM10 {data.current.pm10:.1f} μg/m³")
    if particulate:
        current_summary += " " + ", ".join(particulate) + "."

    forecast_summary = "; ".join(
        f"{point.date}: mean AQI {point.value:.0f} (hourly range {point.minimum:.0f}–{point.maximum:.0f})"
        for point in data.forecast
    )
    summary = current_summary
    if forecast_summary:
        summary += f" Five-day outlook: {forecast_summary}."
    summary += (
        " AQI values are model estimates, not direct NASA satellite readings or "
        "regulatory monitor measurements."
    )
    if data.nasa_weather is not None:
        summary += (
            f" NASA POWER weather context is available through {data.nasa_weather.date}; "
            "its daily data may be delayed."
        )
    elif data.nasa_error:
        summary += f" NASA POWER weather is currently unavailable: {data.nasa_error}"
    return AgentChatResponse(
        message=summary,
        location_data=data,
        assistant_mode="guided",
    )


def _call_openai(
    request: AgentChatRequest, api_key: str
) -> AgentChatResponse:
    history = [
        {"role": item.role, "content": item.content.strip()}
        for item in request.history
        if item.content.strip()
    ]
    messages: List[dict[str, object]] = [
        {
            "role": "system",
            "content": (
                "You are the location assistant for an air-quality dashboard. "
                "When the user asks about a place, call search_places, then use "
                "get_place_air_quality for a matching result before describing its "
                "data. If several places match and the user did not specify which "
                "one, ask them to choose instead of guessing. Summarize the returned "
                "current US AQI, its timestamp, PM2.5/PM10 when available, and up to "
                "five forecast days. Clearly call AQI a model estimate, not a NASA "
                "satellite measurement or regulatory sensor reading. NASA POWER "
                "weather is near-real-time daily context and may be delayed. Never "
                "invent measurements or forecast values."
            ),
        },
        *history[-10:],
        {"role": "user", "content": request.message.strip()},
    ]
    places_by_id: dict[int, PlaceResult] = {}
    location_data: Optional[LocationDashboardResponse] = None

    for _ in range(5):
        try:
            response = httpx.post(
                OPENAI_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": get_openai_model(),
                    "messages": messages,
                    "tools": AGENT_TOOLS,
                    "tool_choice": "auto",
                    "temperature": 0.2,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=504,
                detail="The AI agent request timed out. Please try again.",
            ) from exc
        except httpx.HTTPStatusError as exc:
            status_code = 429 if exc.response.status_code == 429 else 502
            raise HTTPException(
                status_code=status_code,
                detail=(
                    f"The AI agent service returned HTTP {exc.response.status_code}. "
                    "Check its availability and API key."
                ),
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail="The AI agent service could not be reached.",
            ) from exc
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail="The AI agent service returned invalid JSON.",
            ) from exc

        try:
            assistant_message = payload["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise HTTPException(
                status_code=502,
                detail="The AI agent returned an incomplete response.",
            ) from exc
        if not isinstance(assistant_message, dict):
            raise HTTPException(
                status_code=502, detail="The AI agent returned an invalid response."
            )
        messages.append(assistant_message)
        tool_calls = assistant_message.get("tool_calls") or []
        if not tool_calls:
            answer = assistant_message.get("content")
            if not isinstance(answer, str) or not answer.strip():
                raise HTTPException(
                    status_code=502, detail="The AI agent returned an empty response."
                )
            return AgentChatResponse(
                message=answer.strip(),
                location_data=location_data,
                assistant_mode="openai",
            )
        if not isinstance(tool_calls, list):
            raise HTTPException(
                status_code=502, detail="The AI agent returned invalid tool calls."
            )

        for tool_call in tool_calls:
            try:
                call_id = tool_call["id"]
                function = tool_call["function"]
                tool_name = function["name"]
                arguments = json.loads(function["arguments"])
            except (KeyError, TypeError, json.JSONDecodeError) as exc:
                raise HTTPException(
                    status_code=502,
                    detail="The AI agent returned malformed tool arguments.",
                ) from exc
            if not isinstance(arguments, dict) or not isinstance(call_id, str):
                raise HTTPException(
                    status_code=502, detail="The AI agent returned invalid tool arguments."
                )

            try:
                if tool_name == "search_places":
                    query = arguments.get("query")
                    if not isinstance(query, str) or not query.strip():
                        raise HTTPException(
                            status_code=400,
                            detail="A place name is required for location search.",
                        )
                    places = search_places(name=query.strip())
                    places_by_id.update({place.id: place for place in places})
                    tool_result: object = [place.dict() for place in places]
                elif tool_name == "get_place_air_quality":
                    place_id = arguments.get("place_id")
                    if not isinstance(place_id, int) or isinstance(place_id, bool):
                        raise HTTPException(
                            status_code=400, detail="A valid place ID is required."
                        )
                    place = places_by_id.get(place_id)
                    if place is None:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                "Search for the place first and use a place ID "
                                "from the search results."
                            ),
                        )
                    location_data = get_location_dashboard(
                        latitude=place.latitude,
                        longitude=place.longitude,
                        name=place.name,
                        country=place.country,
                        country_code=place.country_code,
                        admin1=place.admin1,
                        place_id=place.id,
                    )
                    tool_result = location_data.dict()
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="The requested agent tool is not available.",
                    )
            except HTTPException as exc:
                tool_result = {"error": exc.detail}
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": json.dumps(tool_result, ensure_ascii=True),
                }
            )

    raise HTTPException(
        status_code=502,
        detail="The AI agent exceeded its tool-call limit before completing the request.",
    )


def chat_with_location_agent(request: AgentChatRequest) -> AgentChatResponse:
    api_key = get_openai_api_key()
    if not api_key:
        return _guided_location_response(request.message)
    return _call_openai(request, api_key)
