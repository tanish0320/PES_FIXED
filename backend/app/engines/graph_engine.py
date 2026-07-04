from typing import List, Dict, Any
import re

def get_graph(case_id: str, store: dict) -> dict:
    if "graphs" not in store:
        store["graphs"] = {}
    if case_id not in store["graphs"]:
        return {"nodes": [], "edges": []}
    return store["graphs"][case_id]

def add_node(case_id: str, node_data: dict, store: dict):
    if "graphs" not in store:
        store["graphs"] = {}
    if case_id not in store["graphs"]:
        store["graphs"][case_id] = {"nodes": [], "edges": []}
        
    graph = store["graphs"][case_id]
    account_id = node_data["account_id"]
    
    # Avoid duplicate nodes
    for node in graph["nodes"]:
        if node["account_id"] == account_id:
            # Update attributes if needed
            node.update(node_data)
            return
            
    graph["nodes"].append(node_data)

def add_edge(case_id: str, edge_data: dict, store: dict):
    if "graphs" not in store:
        store["graphs"] = {}
    if case_id not in store["graphs"]:
        store["graphs"][case_id] = {"nodes": [], "edges": []}
        
    graph = store["graphs"][case_id]
    tx_id = edge_data["tx_id"]
    
    # Avoid duplicate edges
    if any(e["tx_id"] == tx_id for e in graph["edges"]):
        return
        
    graph["edges"].append(edge_data)

def build_money_flow_graph(case_id: str, transactions: List[Dict[str, Any]], entities: Dict[str, Any], store: dict, metrics: Dict[str, Any] = None) -> dict:
    """
    Construct node and edge collections for the money flow visualization.
    Integrates transactions and extracted entities.
    """
    if metrics is None:
        from app.engines.financial_metrics.metrics_engine import FinancialMetricsEngine
        entities_copy = dict(entities)
        # Avoid circular dependencies or missing patterns by passing empty list if missing
        if "patterns" not in entities_copy:
            entities_copy["patterns"] = []
        metrics = FinancialMetricsEngine.compute_metrics(transactions, entities_copy, {"nodes": [], "edges": []})
    if not transactions:
        return {"nodes": [], "edges": []}

    # Find the primary account ID (main account of statement)
    # The statement parser sets sender_account or receiver_account to the main account ID
    # depending on whether it is debit or credit.
    # Let's count occurrences of non-external account IDs
    account_counts = {}
    for tx in transactions:
        for acc in [tx.get("sender_account"), tx.get("receiver_account")]:
            if acc and acc != "external":
                account_counts[acc] = account_counts.get(acc, 0) + 1
    
    primary_acc = max(account_counts, key=account_counts.get) if account_counts else "primary_account"
    primary_risk = 0.0
    case_data = store.get("cases", {}).get(case_id)
    if case_data:
        primary_risk = float(case_data.get("risk_score", 0.0))

    # Initialize graph
    store.setdefault("graphs", {})
    store["graphs"][case_id] = {"nodes": [], "edges": []}

    # Calculate aggregates for the primary node
    total_inflow = 0.0
    total_outflow = 0.0
    tx_count = len(transactions)

    # Temporary aggregates for counterparty nodes
    counterparty_aggregates = {}

    # Define a helper to classify node types
    def classify_counterparty(cp_val: str) -> str:
        if "@" in cp_val:
            return "upi_id"
        if any(m in cp_val.lower() for m in ["paytm", "amazon", "rummy", "junglee", "zomato", "swiggy", "netflix"]):
            return "merchant"
        if len(cp_val) == 11 and cp_val[:4].isalpha() and cp_val[4] == '0':
            return "ifsc"
        if cp_val.replace(" ", "").isalpha():
            return "person"
        return "account"

    # Helper to clean counterparty names
    def clean_cp_name(desc: str) -> str:
        desc_up = desc.upper()
        # Find UPI ID
        upi_match = re.search(r'([\w\-.]+@[\w\-.]+)', desc_up)
        if upi_match:
            return upi_match.group(1).lower()
        # Find NEFT details
        for kw in ["NEFT-", "NEFT/"]:
            if kw in desc_up:
                parts = desc.split(kw.replace("-", "").replace("/", ""))
                if len(parts) > 1:
                    subparts = re.split(r'[-/]', parts[1])
                    for sp in subparts:
                        if len(sp) > 3 and sp.isalpha() and sp not in ["TRANSFER", "FAMILY", "OWNACT", "SELF"]:
                            return sp.strip().title()
        # Find IMPS details
        if "IMPS/" in desc_up:
            parts = desc.split("/")
            if len(parts) > 3:
                return parts[3].strip().title()
        
        # General word cleanup
        words = [w for w in re.split(r'[/|\-,\s]+', desc_up) if w.isalpha() and len(w) > 3]
        words = [w for w in words if w not in ["TRANSFER", "UPI", "IMPS", "NEFT", "RTGS", "CASH", "WITHDRAWAL", "DEPOSIT"]]
        if words:
            return " ".join(words[:2]).title()
            
        return "External Counterparty"

    # Process all transactions to build edges and collect node statistics
    for tx in transactions:
        amount = tx["amount"]
        is_debit = tx["is_debit"]
        channel = tx.get("channel", "OTHER")
        tx_id = tx["tx_id"]
        date_str = tx.get("timestamp", "")
        desc = tx.get("description", "")

        # Extract counterparty name/value
        cp_val = clean_cp_name(desc)
        cp_type = classify_counterparty(cp_val)

        if is_debit:
            total_outflow += amount
            from_node = primary_acc
            to_node = cp_val
        else:
            total_inflow += amount
            from_node = cp_val
            to_node = primary_acc

        # Track counterparty details
        if cp_val not in counterparty_aggregates:
            counterparty_aggregates[cp_val] = {
                "account_id": cp_val,
                "node_type": cp_type,
                "label": cp_val,
                "risk": 40.0 if cp_type in ["upi_id", "person"] else 20.0, # base risk for counterparties
                "status": "suspicious" if cp_type in ["upi_id", "person"] else "active",
                "tx_count": 0,
                "total_inflow": 0.0,
                "total_outflow": 0.0
            }
        
        cp_agg = counterparty_aggregates[cp_val]
        cp_agg["tx_count"] += 1
        if is_debit:
            cp_agg["total_inflow"] += amount # Outflow from primary is inflow to counterparty
        else:
            cp_agg["total_outflow"] += amount

        # Add Edge
        edge_data = {
            "from": from_node,
            "to": to_node,
            "tx_id": tx_id,
            "amount": amount,
            "channel": channel,
            "date": date_str,
            "description": desc
        }
        add_edge(case_id, edge_data, store)

    # Determine primary account holder name
    holder_names = [n["value"] for n in entities.get("names", [])]
    holder_label = f"{holder_names[0]} (Owner)" if holder_names else f"Account {primary_acc}"

    # Retrieve metrics for primary node
    avg_holding = metrics["account_metrics"]["average_holding_time"]["value"]
    retention_pct = metrics["account_metrics"]["balance_retention_percent"]["value"]
    ben_count = metrics["account_metrics"]["unique_beneficiaries"]["value"]
    velocity_val = metrics["transaction_metrics"]["transaction_velocity"]["value"]
    tx_per_day = velocity_val.get("tx_per_day", 0.0) if isinstance(velocity_val, dict) else 0.0

    # Add Primary Account Node
    primary_node = {
        "account_id": primary_acc,
        "node_type": "account",
        "label": holder_label,
        "risk": primary_risk,
        "status": "suspicious" if primary_risk >= 60 else "active",
        "tx_count": tx_count,
        "total_inflow": total_inflow,
        "total_outflow": total_outflow,
        "average_holding_time": str(avg_holding),
        "money_retention": f"{retention_pct:.1f}%" if isinstance(retention_pct, (int, float)) else "0.0%",
        "beneficiary_count": int(ben_count),
        "velocity": f"{tx_per_day:.1f} tx/day",
        "risk_contribution": f"{primary_risk:.0f}%",
        "connected_transactions": int(tx_count)
    }
    add_node(case_id, primary_node, store)

    # Add Counterparty Nodes
    for cp_node in counterparty_aggregates.values():
        # Inherit high risk if they are part of structuring / high volume
        if cp_node["total_inflow"] > 100000 or cp_node["total_outflow"] > 100000:
            cp_node["risk"] = max(cp_node["risk"], 70.0)
            cp_node["status"] = "suspicious"
        
        # Populate counterparty hover fields
        cp_node.update({
            "average_holding_time": "N/A (External)",
            "money_retention": "N/A (External)",
            "beneficiary_count": 0,
            "velocity": f"{cp_node['tx_count']} tx",
            "risk_contribution": f"{cp_node['risk']:.0f}%",
            "connected_transactions": int(cp_node["tx_count"])
        })
        add_node(case_id, cp_node, store)

    # We are no longer adding orphan entity nodes (banks, upi_ids, merchants) 
    # to the graph if they are not actual counterparties, 
    # to prevent clutter and perceived cross-statement data leakage.

    return get_graph(case_id, store)
