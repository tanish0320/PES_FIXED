from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List, Optional
import json

from app.core.data_store import data_store
from copilot.models import CopilotChatRequest
from copilot.chat_service import CopilotChatService

router = APIRouter(prefix="/api/copilot")

class DataStoreProvider:
    """
    Concrete implementation of the DataProvider interface.
    Fetches data from SENTINEL's current global in-memory data store.
    This can be easily replaced in the future with a PostgreSQL or MongoDB implementation.
    """

    def get_case(self, case_id: str) -> Dict[str, Any]:
        return data_store.get("cases", {}).get(case_id) or {}

    def get_graph(self, case_id: str) -> Dict[str, Any]:
        graph = data_store.get("graphs", {}).get(case_id) or {"nodes": [], "edges": []}
        # Deep copy to prevent mutating the database
        cleaned_graph = {"nodes": [], "edges": []}
        for n in graph.get("nodes", []):
            cleaned_graph["nodes"].append(dict(n))
        for e in graph.get("edges", []):
            edge_copy = dict(e)
            if hasattr(edge_copy.get("date"), "isoformat"):
                edge_copy["date"] = edge_copy["date"].isoformat()
            cleaned_graph["edges"].append(edge_copy)
        return cleaned_graph

    def get_report(self, case_id: str) -> Dict[str, Any]:
        return data_store.get("reports", {}).get(case_id) or {}

    def get_patterns(self, case_id: str) -> List[Dict[str, Any]]:
        return self.get_report(case_id).get("detected_patterns", [])

    def get_transactions(self, case_id: str) -> List[Dict[str, Any]]:
        case = self.get_case(case_id)
        tx_ids = case.get("transactions", [])
        tx_store = data_store.get("transactions", {})
        tx_list = []
        for tid in tx_ids:
            if tid in tx_store:
                tx_copy = dict(tx_store[tid])
                if hasattr(tx_copy.get("date"), "isoformat"):
                    tx_copy["date"] = tx_copy["date"].isoformat()
                tx_list.append(tx_copy)
        return tx_list

    def get_timeline(self, case_id: str) -> List[Dict[str, Any]]:
        return self.get_report(case_id).get("timeline", [])

    def get_entities(self, case_id: str) -> List[Dict[str, Any]]:
        case = self.get_case(case_id)
        # Check case entities
        ents = case.get("entities", [])
        if isinstance(ents, dict):
            # Convert dict structure to flat list if needed
            flat_ents = []
            for etype, items in ents.items():
                for item in items:
                    val = item.get("value") if isinstance(item, dict) else item
                    flat_ents.append({
                        "value": val,
                        "type": etype,
                        "context": f"Extracted {etype}"
                    })
            return flat_ents
        return ents

    def search_entity(self, query: str) -> List[Dict[str, Any]]:
        results = []
        q_low = query.lower().strip()
        search_index = data_store.get("search_index", {})
        for key, entries in search_index.items():
            if q_low in key:
                for entry in entries:
                    results.append({
                        "value": entry.get("value"),
                        "type": entry.get("type"),
                        "context": entry.get("context")
                    })
        return results

    def get_top_beneficiaries(self, case_id: str) -> List[Dict[str, Any]]:
        graph = self.get_graph(case_id)
        nodes = graph.get("nodes", [])
        beneficiaries = []
        for n in nodes:
            nd = n.get("data", n) if isinstance(n, dict) else n
            if nd.get("node_type") != "account" and nd.get("total_inflow", 0) > 0:
                beneficiaries.append({
                    "account_id": nd.get("account_id"),
                    "total_inflow": nd.get("total_inflow", 0),
                    "tx_count": nd.get("tx_count", 0)
                })
        return sorted(beneficiaries, key=lambda x: x["total_inflow"], reverse=True)

    def get_high_risk_transactions(self, case_id: str) -> List[Dict[str, Any]]:
        txs = self.get_transactions(case_id)
        return [tx for tx in txs if float(tx.get("risk_score", 0)) >= 60 or tx.get("risk_flag")]


# Instantiation
_provider = DataStoreProvider()
_chat_service = CopilotChatService(_provider)

def get_chat_service() -> CopilotChatService:
    return _chat_service

@router.post("/chat")
async def chat(
    payload: CopilotChatRequest,
    chat_service: CopilotChatService = Depends(get_chat_service)
):
    """
    Main chat streaming endpoint. Yields token deltas wrapped in JSON lines
    along with the final structured JSON analysis block.
    """
    if payload.case_id and not data_store.get("cases", {}).get(payload.case_id):
        # Case specified but not found in storage
        async def err_generator():
            yield json.dumps({
                "type": "final",
                "data": {
                    "answer": "No active investigation has been loaded.",
                    "evidence": [],
                    "confidence": 0,
                    "sources": [],
                    "suggested_actions": [],
                    "follow_up_questions": ["Upload a bank statement first.", "Select an investigation."]
                }
            }) + "\n"
        return StreamingResponse(err_generator(), media_type="application/x-ndjson")

    def response_streamer():
        try:
            for chunk in chat_service.chat_stream(payload):
                yield chunk
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield json.dumps({
                "type": "final",
                "data": {
                    "answer": f"System error occurred: {str(e)}",
                    "evidence": [],
                    "confidence": 0,
                    "sources": [],
                    "suggested_actions": [],
                    "follow_up_questions": []
                }
            }) + "\n"

    return StreamingResponse(response_streamer(), media_type="application/x-ndjson")

@router.get("/health")
def health(chat_service: CopilotChatService = Depends(get_chat_service)):
    return chat_service.llm.health()
