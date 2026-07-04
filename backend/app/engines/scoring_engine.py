from typing import List, Dict, Any
from collections import defaultdict

def score_investigation(
    transactions: List[Dict[str, Any]],
    patterns: List[Dict[str, Any]],
    account_id: str,
    entities: Dict[str, Any] = None,
    graph: Dict[str, Any] = None,
    metrics: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Consumes pattern detection output and computes investigation-level risk score.
    Now relies entirely on the modular Financial Investigation Metrics Framework.
    """
    # Build or set dependencies
    if entities is None:
        from app.engines.entity_extractor import EntityExtractor
        entities = EntityExtractor.extract_all(transactions)
    
    # Propagate patterns to entities for the metrics engine
    entities["patterns"] = patterns

    if graph is None:
        from app.engines.graph_engine import build_money_flow_graph
        graph = build_money_flow_graph("TEMP", transactions, entities, {})

    if metrics is None:
        from app.engines.financial_metrics.metrics_engine import FinancialMetricsEngine
        metrics = FinancialMetricsEngine.compute_metrics(transactions, entities, graph)

    # 1. Base Score calculation based on Metric values and configurations
    risk_score = 0.0

    # Rapid Money Movement (+20)
    rapid = metrics["transaction_metrics"]["rapid_money_movement"]
    if rapid["value"]["count"] > 0:
        risk_score += 20.0

    # Circular Flow (+30)
    cycle = metrics["graph_metrics"]["largest_cycle"]
    if cycle["value"] > 0:
        risk_score += 30.0

    # Layer Depth (+15)
    layer = metrics["graph_metrics"]["maximum_layer_depth"]
    if layer["value"] >= 2:
        risk_score += 15.0

    # Velocity (+10)
    velocity = metrics["transaction_metrics"]["transaction_velocity"]
    if velocity["severity"] in ["High", "Medium"]:
        risk_score += 10.0

    # Immediate Balance Drain (+15)
    drain = metrics["transaction_metrics"]["immediate_balance_drain"]
    if drain["value"] >= 50.0:
        risk_score += 15.0

    # Round Amount % (+5)
    round_amt = metrics["amount_metrics"]["round_amount_percent"]
    if round_amt["metadata"].get("overall_round_percentage", 0.0) >= 30.0:
        risk_score += 5.0

    # Repeated Amounts (+10)
    repeats = metrics["amount_metrics"]["repeated_amount_detector"]
    if repeats["metadata"].get("total_repeated_count", 0) > 0:
        risk_score += 10.0

    # Pattern Density (+10)
    density = metrics["investigation_metrics"]["pattern_density"]
    if density["value"] >= 20.0:
        risk_score += 10.0

    final_score = int(min(100.0, risk_score))
    
    # Set baseline minimum score for non-empty statement
    if final_score == 0 and transactions:
        final_score = 15

    # Risk Level classification
    if final_score >= 80:
        risk_level = "CRITICAL"
    elif final_score >= 60:
        risk_level = "HIGH"
    elif final_score >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # Human-readable explanations compiled from metrics
    explanations = []
    for metric_res in metrics["all_metrics"]:
        if metric_res.get("severity") in ["High", "Medium"] and metric_res.get("value") not in [0, 0.0, None, [], "N/A"]:
            # Only list failed transaction if failed count > 0
            if metric_res["name"] == "Failed Transactions":
                if metric_res["value"].get("failed_count", 0) > 0:
                    explanations.append(metric_res["description"])
            else:
                explanations.append(metric_res["description"])

    if not explanations:
        explanations.append("Routine transaction patterns with low risk indicators.")

    # 2. Top Contributing Transactions
    # Identify largest inflow and outflow using metrics metadata
    inflows = [t for t in transactions if not t.get("is_debit", True) and not t.get("is_internal_transfer", False)]
    largest_inflow_tx = max(inflows, key=lambda x: x["amount"]) if inflows else None
    
    outflows = [t for t in transactions if t.get("is_debit", True) and not t.get("is_internal_transfer", False)]
    largest_outflow_tx = max(outflows, key=lambda x: x["amount"]) if outflows else None

    # Link related transactions to patterns
    tx_patterns = defaultdict(list)
    for pat in patterns:
        for tx_id in pat.get("related_transactions", []):
            tx_patterns[tx_id].append(pat["name"])

    scored_txs = []
    for tx in transactions:
        tx_id = tx["tx_id"]
        amount = tx["amount"]
        contrib = 0.0
        reasons = []

        if tx_id in tx_patterns:
            pats = tx_patterns[tx_id]
            contrib += len(pats) * 20.0
            reasons.append(f"Linked to {', '.join(pats)}")
            
        if amount >= 50000:
            contrib += min(40.0, (amount / 100000.0) * 10)
            reasons.append(f"High amount: \u20b9{amount:,.2f}")
            
        if largest_inflow_tx and tx_id == largest_inflow_tx["tx_id"]:
            contrib += 15.0
            reasons.append("Largest single inflow")
        if largest_outflow_tx and tx_id == largest_outflow_tx["tx_id"]:
            contrib += 15.0
            reasons.append("Largest single outflow")

        if contrib > 0:
            reason_str = " + ".join(reasons)
            contribution_pct = int(min(35.0, contrib))
            scored_txs.append({
                "tx_id": tx_id,
                "amount": amount,
                "reason": reason_str,
                "contribution": contribution_pct
            })

    top_contributions = sorted(scored_txs, key=lambda x: x["contribution"], reverse=True)[:10]

    return {
        "risk_score": final_score,
        "risk_level": risk_level,
        "explanation": explanations,
        "triggered_patterns": [p["name"] for p in patterns],
        "top_contributing_transactions": top_contributions
    }
