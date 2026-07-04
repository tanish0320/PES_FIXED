from typing import Dict, Any, List, Optional

class ToolRouter:
    """
    Tool Router that coordinates calling specific data extraction tools based
    on investigator intent. Does not allow the LLM to search directly; instead,
    routes intent to predefined data provider tools and serves structured JSON back.
    """

    def __init__(self, data_provider: Any):
        """
        Inject a database-agnostic DataProvider that implements retrieval methods.
        """
        self.provider = data_provider

    def route_and_execute(self, intent: str, case_id: Optional[str], selected_node: Optional[str], message: str) -> Dict[str, Any]:
        """
        Executes tools based on classified intent and compiles a structured payload.
        """
        results = {
            "case": {},
            "patterns": [],
            "transactions": [],
            "timeline": [],
            "graph": {"nodes": [], "edges": []},
            "entities": [],
            "report_summary": "",
            "selected_node": selected_node,
            "top_beneficiaries": [],
            "high_risk_transactions": []
        }

        if not case_id:
            return results

        # 1. Route to specific tools based on intent
        if intent == "CASE_EXPLANATION":
            results["case"] = self.provider.get_case(case_id)
            results["patterns"] = self.provider.get_patterns(case_id)
            results["high_risk_transactions"] = self.provider.get_high_risk_transactions(case_id)
            
        elif intent == "GRAPH_EXPLANATION":
            results["case"] = self.provider.get_case(case_id)
            results["graph"] = self.provider.get_graph(case_id)
            
        elif intent == "REPORT_SUMMARY":
            results["case"] = self.provider.get_case(case_id)
            report = self.provider.get_report(case_id)
            results["report_summary"] = report.get("executive_summary", "")
            
        elif intent == "ENTITY_LOOKUP":
            results["case"] = self.provider.get_case(case_id)
            results["entities"] = self.provider.get_entities(case_id)
            results["graph"] = self.provider.get_graph(case_id)
            # Check if there is an entity mentioned in the user message
            # For simplicity, extract words and search
            for word in message.split():
                if len(word) >= 3 and word.isalnum():
                    search_results = self.provider.search_entity(word)
                    if search_results:
                        results["entities"].extend(search_results)
                        
        elif intent == "TRANSACTION_LOOKUP":
            results["case"] = self.provider.get_case(case_id)
            results["transactions"] = self.provider.get_transactions(case_id)
            results["high_risk_transactions"] = self.provider.get_high_risk_transactions(case_id)
            
        elif intent == "PATTERN_EXPLANATION":
            results["case"] = self.provider.get_case(case_id)
            results["patterns"] = self.provider.get_patterns(case_id)
            results["transactions"] = self.provider.get_transactions(case_id)
            
        elif intent == "TIMELINE_SUMMARY":
            results["timeline"] = self.provider.get_timeline(case_id)
            
        elif intent in ["INVESTIGATION_SUMMARY", "GENERAL_KNOWLEDGE", "FOLLOW_UP"]:
            results["case"] = self.provider.get_case(case_id)
            report = self.provider.get_report(case_id)
            results["report_summary"] = report.get("executive_summary", "")
            results["patterns"] = self.provider.get_patterns(case_id)
            results["top_beneficiaries"] = self.provider.get_top_beneficiaries(case_id)
            
        elif intent == "REPORT_GENERATION":
            results["case"] = self.provider.get_case(case_id)
            report = self.provider.get_report(case_id)
            results["report_summary"] = report.get("executive_summary", "")
            results["timeline"] = self.provider.get_timeline(case_id)
            results["patterns"] = self.provider.get_patterns(case_id)

        # Fallback to ensure basic case metadata is populated
        if not results["case"] and case_id:
            results["case"] = self.provider.get_case(case_id)

        return results
