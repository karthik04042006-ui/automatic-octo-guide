from fastapi import APIRouter

from app.controllers.agent_controller import chat_with_location_agent_controller
from app.models.schemas import AgentChatRequest, AgentChatResponse

router = APIRouter()


@router.post(
    "/api/agent/chat",
    response_model=AgentChatResponse,
    tags=["AI Agent"],
)
def chat_with_location_agent(request: AgentChatRequest) -> AgentChatResponse:
    """Use OpenAI when configured, otherwise look up the requested place directly."""
    return chat_with_location_agent_controller(request)
