from typing import Dict, Any

class TransactionContext:
    """
    Builds context related to transactions, focusing strictly on high-risk,
    suspicious, or high-value records.
    """

    @staticmethod
    def build(tool_results: Dict[str, Any]) -> str:
        transactions = tool_results.get("transactions") or []
        high_risk_txs = tool_results.get("high_risk_transactions") or []

        # Dedup and prioritize high risk
        target_txs = high_risk_txs
        if not target_txs:
            # Fall back to high-value transactions
            target_txs = [tx for tx in transactions if float(tx.get("amount", 0)) > 50000]
        if not target_txs:
            target_txs = transactions

        # Sort by risk score if present, then amount descending
        target_txs = sorted(
            target_txs, 
            key=lambda x: (float(x.get("risk_score", 0)), float(x.get("amount", 0))), 
            reverse=True
        )

        context = []
        if target_txs:
            context.append("### Key Audit Transactions")
            # Limit strictly to top 10
            for tx in target_txs[:10]:
                tx_id = tx.get("tx_id", "N/A")
                date = tx.get("date", "N/A")
                amount = tx.get("amount", 0)
                channel = tx.get("channel", "N/A")
                desc = tx.get("description", "")
                risk = tx.get("risk_score", 0)
                flow_type = "Debit" if tx.get("is_debit", True) else "Credit"
                
                context.append(
                    f"- {tx_id} | {date} | ₹{amount:,} | {flow_type} ({channel}) | {desc} (Risk: {risk}/100)"
                )
            
            if len(target_txs) > 10:
                context.append(f"- ... [and {len(target_txs) - 10} other audit transactions]")
            context.append("")

        return "\n".join(context)
