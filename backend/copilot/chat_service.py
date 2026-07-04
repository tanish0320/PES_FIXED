from typing import Dict, Any, Generator, Optional
import json

from copilot.models import CopilotChatRequest, CopilotChatResponse
from copilot.intent_classifier import IntentClassifier
from copilot.tool_router import ToolRouter
from copilot.context_builder import CaseContext, GraphContext, ReportContext, EntityContext, TransactionContext
from copilot.prompt_builder import PromptBuilder
from copilot.llm_client import OllamaClient
from copilot.response_formatter import ResponseFormatter
from copilot.conversation_memory import ConversationMemory
from copilot.citations import CitationManager
from copilot.cache import CopilotCache

class CopilotChatService:
    """
    Main orchestrator for the SENTINEL AI Investigation Copilot.
    Handles caching, intent classification, context aggregation via providers,
    LLM invocation, citation validation, and structured JSON streaming.
    """

    def __init__(self, data_provider: Any):
        self.llm = OllamaClient()
        self.memory = ConversationMemory()
        self.cache = CopilotCache()
        self.tool_router = ToolRouter(data_provider)

    def chat_stream(self, payload: CopilotChatRequest) -> Generator[str, None, None]:
        case_id = payload.case_id
        message = payload.message
        selected_node = payload.selected_node
        page = payload.page

        # 1. Cache lookup
        cached = self.cache.get(case_id, message)
        if cached:
            # Yield cached final output directly and finish
            yield json.dumps({"type": "final", "data": cached}) + "\n"
            return

        # 2. Intent Classification
        intent = IntentClassifier.classify(message, page)

        # 3. Tool Routing (Retrieve structured data from agnostic provider)
        tool_results = self.tool_router.route_and_execute(intent, case_id, selected_node, message)

        # 4. Context Providers (Compile specific markdown pieces)
        context_parts = []
        context_parts.append(CaseContext.build(tool_results))

        if intent == "GRAPH_EXPLANATION":
            context_parts.append(GraphContext.build(tool_results))
        elif intent in ["REPORT_SUMMARY", "REPORT_GENERATION", "TIMELINE_SUMMARY"]:
            context_parts.append(ReportContext.build(tool_results))
        elif intent == "ENTITY_LOOKUP":
            context_parts.append(EntityContext.build(tool_results))
        elif intent == "TRANSACTION_LOOKUP":
            context_parts.append(TransactionContext.build(tool_results))
        else:
            # Default detailed compilation
            context_parts.append(ReportContext.build(tool_results))
            context_parts.append(TransactionContext.build(tool_results))
            context_parts.append(EntityContext.build(tool_results))

        context_str = "\n\n".join(context_parts)

        # 5. Conversation Memory
        history = self.memory.get_history(case_id) if case_id else []

        # 6. Prompt compilation
        system_prompt = PromptBuilder.get_system_prompt()
        user_prompt = PromptBuilder.build_user_prompt(intent, context_str, history, message)

        # 7. LLM Invocation & Token Streaming
        full_raw_response = ""
        
        try:
            # We stream the raw response to the frontend token-by-token
            # However, to maintain the JSON contract, we yield a token chunk event
            for token in self.llm.generate_stream(user_prompt, system_prompt):
                full_raw_response += token
                # Yield token wrapped in JSON
                yield json.dumps({"type": "token", "delta": token}) + "\n"
        except Exception as e:
            # Yield error format on failure and stop
            yield json.dumps({"type": "error", "message": "AI Copilot Offline"}) + "\n"
            return

        # Yield complete type at the end of token generation
        yield json.dumps({"type": "complete"}) + "\n"

        # 8. Formatting and Post-Processing (JSON Validation & Citations check)
        formatted_json = ResponseFormatter.format_response(full_raw_response, intent)
        cleaned_json = CitationManager.validate_and_clean(formatted_json, tool_results)

        # 9. Update Cache & Conversation Memory
        if case_id:
            self.cache.set(case_id, message, cleaned_json)
            # Store memory as plaintext explanation to avoid token bloating in history
            self.memory.add_exchange(case_id, message, cleaned_json["answer"])

        # 10. Yield final structured JSON payload
        yield json.dumps({"type": "final", "data": cleaned_json}) + "\n"
