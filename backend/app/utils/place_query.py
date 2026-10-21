import re
from typing import Optional


def extract_place_query(message: str) -> Optional[str]:
    normalized = re.sub(r"\s+", " ", message).strip(" \t\r\n?.!,")
    location_match = re.search(
        r"\b(?:in|near|around|at|for)\s+(.+)$",
        normalized,
        flags=re.IGNORECASE,
    )
    query = location_match.group(1) if location_match else normalized
    query = re.sub(
        r"\b(?:right now|currently|today|tomorrow|please|current|latest|forecast|weather|aqi|air quality|pollution|level|levels|what is|what's|how is|tell me|get|show me|find|check|give me|of)\b",
        " ",
        query,
        flags=re.IGNORECASE,
    )
    query = re.sub(r"\s+", " ", query).strip(" \t\r\n?.!,")
    return query if len(query) >= 2 else None
