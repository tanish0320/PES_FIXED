from datetime import datetime, timezone
from typing import List, Dict, Any
import uuid

class CaseManager:
    @staticmethod
    def create_investigation(
        case_id: str,
        account_id: str,
        risk_data: Dict[str, Any],
        transactions: List[Dict[str, Any]],
        patterns: List[Dict[str, Any]],
        entities: Dict[str, Any],
        parser_stats: Dict[str, Any],
        source_file: str,
        store: dict,
        account_ids: List[str] = None,
        files_uploaded: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create and record a unified case investigation profile in the data store.
        """
        risk_score = float(risk_data.get("risk_score", 0.0))
        risk_level = risk_data.get("risk_level", "LOW")
        
        # Calculate status
        status = "ANALYZED"
        if risk_level in ["CRITICAL", "HIGH"]:
            status = "HIGH_RISK"
        elif risk_score > 0:
            status = "NEW"
 
        # Calculate totals
        total_credits = sum(float(tx.get("amount", 0.0)) for tx in transactions if not tx.get("is_debit", True) and not tx.get("is_internal_transfer", False))
        total_debits = sum(float(tx.get("amount", 0.0)) for tx in transactions if tx.get("is_debit", True) and not tx.get("is_internal_transfer", False))
 
        # Identify high risk transactions (top contributors or amount > 50,000)
        high_risk_tx_ids = []
        top_contribs = risk_data.get("top_contributing_transactions", [])
        if top_contribs:
            high_risk_tx_ids = [str(tc.get("tx_id")) for tc in top_contribs]
        else:
            high_risk_tx_ids = [str(tx["tx_id"]) for tx in transactions if tx["amount"] >= 50000]
 
        # Extract statement period
        statement_from = ""
        statement_to = ""
        if transactions:
            sorted_txs = sorted(transactions, key=lambda x: x["date"])
            statement_from = sorted_txs[0]["date"].isoformat() + "Z"
            statement_to = sorted_txs[-1]["date"].isoformat() + "Z"
 
        pattern_names = [p["name"] for p in patterns]
 
        case_record = {
            "case_id": case_id,
            "account_id": account_id,
            "status": status,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "total_transactions": len(transactions),
            "total_credits": total_credits,
            "total_debits": total_debits,
            "high_risk_transactions": high_risk_tx_ids,
            "patterns_detected": pattern_names,
            "pattern_count": len(pattern_names),
            "entities": entities,
            "statement_period": {
                "from": statement_from,
                "to": statement_to
            },
            "source_file": source_file,
            "parser_confidence": float(parser_stats.get("confidence", 100.0)),
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "transactions": [tx["tx_id"] for tx in transactions],
            "actions_taken": [],
            "account_ids": account_ids or [account_id],
            "files_uploaded": files_uploaded or [{
                "filename": source_file,
                "status": "SUCCESS",
                "account_id": account_id,
                "confidence": float(parser_stats.get("confidence", 100.0)),
                "rows_parsed": len(transactions),
                "total_rows": len(transactions),
                "skipped_rows": 0,
                "warnings": parser_stats.get("warnings", []),
                "source_format": parser_stats.get("source_format", "Unknown")
            }]
        }
 
        # Store in db
        store.setdefault("cases", {})
        store["cases"][case_id] = case_record
        return case_record
