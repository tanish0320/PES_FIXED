from typing import Dict, Any

class CaseContext:
    """
    Builds context related to case metadata, status, risk parameters, and file summaries.
    """

    @staticmethod
    def build(tool_results: Dict[str, Any]) -> str:
        case = tool_results.get("case") or {}
        if not case:
            return "No case metadata available."

        context = [
            "### Case Summary Profile",
            f"- Case ID: {case.get('case_id', 'N/A')}",
            f"- Primary Account ID: {case.get('account_id', 'N/A')}",
            f"- Investigation Status: {case.get('status', 'N/A')}",
            f"- Risk Assessment: {case.get('risk_score', 0)}/100 ({case.get('risk_level', 'LOW')})",
            f"- Statement Audit Period: {case.get('statement_period', {}).get('from', 'N/A')} to {case.get('statement_period', {}).get('to', 'N/A')}",
            f"- Total Transactions: {case.get('total_transactions', 0)}",
            f"- Total Debits Volume: ₹{case.get('total_debits', 0):,}",
            f"- Total Credits Volume: ₹{case.get('total_credits', 0):,}",
            f"- Source Statement File: {case.get('source_file', 'N/A')}"
        ]
        return "\n".join(context)
