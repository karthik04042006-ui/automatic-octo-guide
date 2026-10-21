from app.models.schemas import AgentChatRequest, AgentChatResponse
from app.services.agent_service import chat_with_location_agent


def chat_with_location_agent_controller(
    request: AgentChatRequest,
) -> AgentChatResponse:
    return chat_with_location_agent(request)
