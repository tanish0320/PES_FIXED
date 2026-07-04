import time
from typing import Dict, Any, List
from app.engines.financial_metrics.registry import ALL_METRICS
from app.engines.financial_metrics.explanations import METRIC_METADATA

class SmartInt(int):
    def __new__(cls, val, val_dict=None):
        return super().__new__(cls, int(val))
    def __init__(self, val, val_dict=None):
        self.val_dict = val_dict or {}
    def __getitem__(self, key):
        return self.val_dict.get(key, 0)
    def get(self, key, default=None):
        return self.val_dict.get(key, default)

class SmartFloat(float):
    def __new__(cls, val, val_dict=None):
        return super().__new__(cls, float(val))
    def __init__(self, val, val_dict=None):
        self.val_dict = val_dict or {}
    def __getitem__(self, key):
        return self.val_dict.get(key, 0.0)
    def get(self, key, default=None):
        return self.val_dict.get(key, default)

class SmartStr(str):
    def __new__(cls, val, val_dict=None):
        return super().__new__(cls, str(val))
    def __init__(self, val, val_dict=None):
        self.val_dict = val_dict or {}
    def __getitem__(self, key):
        return self.val_dict.get(key, "")
    def get(self, key, default=None):
        return self.val_dict.get(key, default)

def create_smart_value(val, val_dict=None):
    if isinstance(val, float):
        return SmartFloat(val, val_dict)
    elif isinstance(val, int) and not isinstance(val, bool):
        return SmartInt(val, val_dict)
    else:
        return SmartStr(val, val_dict)

def standardize_metric(res: Dict[str, Any], transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    name = res.get("name", "")
    category = res.get("category", "")
    
    # Generate unique ID
    metric_id = FinancialMetricsEngine.to_snake_case(name)
    if name == "Round Amount":
        metric_id = "round_amount_percent"
    elif name == "Largest Cycle":
        metric_id = "largest_cycle"

    # Handle Not Available status
    if res.get("status") == "Not Available" or res.get("value") is None:
        reason = "No failed transaction records present in uploaded bank statements." if name == "Failed Transaction Metrics" else f"No {name.lower()} records present in uploaded bank statements."
        return {
            "id": metric_id,
            "name": name,
            "category": category,
            "status": "Not Available",
            "reason": reason
        }

    # Fetch metadata
    meta_info = METRIC_METADATA.get(metric_id, {
        "weight": 5,
        "why_it_matters": "Forensic pattern indicator.",
        "how_calculated": "Rule-based transactional pattern extraction."
    })
    
    weight = meta_info.get("weight", 5)
    why_it_matters = meta_info.get("why_it_matters")
    how_calculated = meta_info.get("how_calculated")
    
    # Extract value and formatted value
    raw_val = res.get("value")
    metadata = res.get("metadata", {})
    desc = res.get("description", "")
    
    val = raw_val
    val_dict = {}
    
    if isinstance(raw_val, dict):
        val_dict = raw_val
        if "count" in raw_val:
            val = raw_val["count"]
        elif "tx_per_day" in raw_val:
            val = raw_val["tx_per_day"]
        elif "largest_burst" in raw_val:
            val = raw_val["largest_burst"]
        elif "dormancy_days" in raw_val:
            val = raw_val["dormancy_days"]
        elif "failed_count" in raw_val:
            val = raw_val["failed_count"]
        else:
            val = 0
            
    # For repeated amount detector, the value is count
    if metric_id == "repeated_amount_detector" and isinstance(raw_val, dict):
        val = metadata.get("total_repeated_count", len(raw_val.get("top_repeated", {})))
        
    # For round amount percent
    if metric_id == "round_amount_percent":
        val = metadata.get("overall_round_percentage", raw_val if isinstance(raw_val, (int, float)) else 0.0)
        
    # For first transaction equals last transaction
    if metric_id == "first_transaction_equals_last_transaction":
        val = 1 if metadata.get("matched", False) or raw_val is True else 0

    # For highest betweenness centrality, the value is the max betweenness float
    if metric_id == "highest_betweenness":
        val = metadata.get("max_betweenness", 0.0)
        val_dict = {"node": raw_val}

    # Ensure value is smart (supporting dictionary lookups)
    value_obj = create_smart_value(val, val_dict)
    
    # Generate Formatted Value
    formatted_value = f"{val}"
    if isinstance(val, (int, float)):
        if metric_id == "rapid_money_movement":
            formatted_value = f"{val} Rapid Transfers"
        elif metric_id == "transaction_velocity":
            formatted_value = f"{val:.1f} tx/day"
        elif metric_id == "burst_activity":
            formatted_value = f"{val} transactions in burst"
        elif metric_id == "dormant_activation":
            formatted_value = f"{val} Days Dormancy"
        elif metric_id == "immediate_balance_drain":
            formatted_value = f"{val:.1f}% Drained"
        elif metric_id == "repeated_amount_detector":
            formatted_value = f"{val} Repeated Amounts"
        elif metric_id == "round_amount_percent":
            formatted_value = f"{val:.1f}% Round Amounts"
        elif metric_id == "first_transaction_equals_last_transaction":
            formatted_value = "Matched" if val else "No Match"
        elif metric_id in ["fifo_score", "lifo_score"]:
            formatted_value = f"{val:.1f}% Match"
        elif metric_id in ["split_amount_ratio", "merge_ratio"]:
            formatted_value = f"{val:.1f} Ratio"
        elif metric_id == "large_to_small_compression":
            formatted_value = f"{val:.1f}% Compression"
        elif metric_id == "balance_retention_percent":
            formatted_value = f"{val:.1f}% Retained"
        elif metric_id == "beneficiary_concentration_index":
            formatted_value = f"{val:.2f} HHI Index"
        elif metric_id == "failed_transaction_metrics":
            formatted_value = f"{val} Failed Transactions"
        elif category == "Account Metrics" and any(k in metric_id for k in ["volume", "flow", "average", "maximum", "credit", "debit"]) and "count" not in metric_id:
            formatted_value = f"₹{val:,.2f}"
        elif metric_id == "maximum_layer_depth":
            formatted_value = f"{val} Hops Deep"
        elif metric_id == "longest_money_path":
            formatted_value = f"{val} Steps Long"
        elif metric_id == "largest_transaction_path":
            formatted_value = f"₹{val:,.2f} Volume"
        elif metric_id == "highest_degree":
            formatted_value = f"{val} Connections"
        elif metric_id == "highest_betweenness":
            formatted_value = f"{val:.2f} Betweenness"
        elif metric_id == "largest_cycle":
            formatted_value = f"{val}-Node Cycle"
        elif metric_id == "graph_density":
            formatted_value = f"{val:.2f}% Density"
        elif metric_id == "average_degree":
            formatted_value = f"{val:.2f} Avg Degree"
        elif metric_id == "money_concentration_percent":
            formatted_value = f"{val:.1f}% Concentration"
        elif metric_id == "pattern_count":
            formatted_value = f"{val} Patterns"
        elif metric_id == "pattern_diversity":
            formatted_value = f"{val} Pattern Types"
        elif metric_id == "pattern_density":
            formatted_value = f"{val:.1f}% Pattern Density"
        elif metric_id == "patterns_per_100_transactions":
            formatted_value = f"{val:.1f} per 100 tx"
        elif metric_id == "entity_count":
            formatted_value = f"{val} Entities"
        elif metric_id == "account_count":
            formatted_value = f"{val} Accounts"
        elif metric_id == "merchant_count":
            formatted_value = f"{val} Merchants"
        elif metric_id == "upi_count":
            formatted_value = f"{val} UPI IDs"
        elif metric_id == "bank_count":
            formatted_value = f"{val} Banks"
        elif metric_id == "investigation_confidence":
            formatted_value = f"{val:.1f}% Confidence"
        elif metric_id == "evidence_count":
            formatted_value = f"{val} Evidence Nodes"
        elif metric_id == "suspicious_transaction_percent":
            formatted_value = f"{val:.1f}% Suspicious"
        elif metric_id == "average_daily_volume":
            formatted_value = f"₹{val:,.2f}/day"
            
    if metric_id == "average_holding_time":
        formatted_value = f"{val} Holding Time"
    elif metric_id == "most_connected_account":
        formatted_value = f"Hub: {val}"
    elif metric_id == "critical_bridge_node":
        formatted_value = f"Choke Point: {val}"
    elif metric_id == "highest_risk_entity":
        formatted_value = f"Top Target: {val}"
    elif metric_id == "highest_risk_day":
        formatted_value = f"Peak Date: {val}"
    elif metric_id == "highest_risk_transaction":
        formatted_value = f"Tx: {val}"

    # Calculate risk_contribution based on specific metrics
    severity = res.get("severity", "Low")
    risk_contribution = 0
    
    if metric_id == "rapid_money_movement":
        risk_contribution = 20 if val > 0 else 0
    elif metric_id == "largest_cycle":
        risk_contribution = 30 if val > 0 else 0
    elif metric_id == "maximum_layer_depth":
        risk_contribution = 15 if val >= 2 else 0
    elif metric_id == "transaction_velocity":
        risk_contribution = 10 if severity in ["High", "Medium"] else 0
    elif metric_id == "immediate_balance_drain":
        risk_contribution = 15 if val >= 50.0 else 0
    elif metric_id == "round_amount_percent":
        risk_contribution = 5 if val >= 30.0 else 0
    elif metric_id == "repeated_amount_detector":
        risk_contribution = 10 if val > 0 else 0
    elif metric_id == "pattern_density":
        risk_contribution = 10 if val >= 20.0 else 0

    # Build dynamic evidence list
    evidence = []
    if metric_id == "rapid_money_movement":
        evidence = [
            f"{val} qualifying rapid transfers detected",
            f"Average transfer delay: {int(val_dict.get('average_transfer_delay', 0) / 60)} minutes",
            f"Largest rapid flow: ₹{val_dict.get('largest_amount', 0.0):,.2f}"
        ]
    elif metric_id == "transaction_velocity":
        evidence = [
            f"Average daily velocity: {val:.1f} tx/day",
            f"Peak activity: {val_dict.get('peak_day', 'N/A')} with {max(metadata.get('daily_counts', {}).values()) if metadata.get('daily_counts') else 0} transactions",
            f"Peak hour of day: {val_dict.get('peak_hour', 'N/A')}:00"
        ]
    elif metric_id == "burst_activity":
        evidence = [
            f"Largest transaction spike: {val} transfers",
            f"Spike intensity: {val_dict.get('burst_intensity', 0.0):.1f} transactions/hour",
            f"Burst window: {val_dict.get('burst_duration', 0.0):.1f} hours"
        ]
    elif metric_id == "dormant_activation":
        evidence = [
            f"Inactivity gap: {val} days",
            f"Reactivation activity: {metadata.get('activation_tx_count', 0)} transactions totaling ₹{metadata.get('activation_tx_volume', 0.0):,.2f}"
        ]
    elif metric_id == "immediate_balance_drain":
        evidence = [
            f"Drained percentage: {val:.1f}% within 24 hours",
            f"Drained volume: ₹{metadata.get('drained_volume', 0.0):,.2f} out of ₹{metadata.get('total_inflow', 0.0):,.2f}"
        ]
    elif metric_id == "repeated_amount_detector":
        evidence = [
            f"{val} repeated transactions detected",
            f"Top repeated: ₹{val_dict.get('top_repeated')[0] if val_dict.get('top_repeated') else 0:,.2f}"
        ]
    elif metric_id == "round_amount_percent":
        evidence = [
            f"{val:.1f}% of transfers are round numbers",
            f"Round transfers count: {metadata.get('round_amount_count', 0)} transactions"
        ]
    elif metric_id == "first_transaction_equals_last_transaction":
        evidence = [
            f"Match status: {metadata.get('matched', False)}",
            f"Initial transfer: ₹{metadata.get('first_amount', 0.0):,.2f}"
        ]
    elif metric_id == "fifo_score":
        evidence = [
            f"FIFO correlation rate: {val:.1f}%",
            f"Chains matched: {metadata.get('matched_chains_count', 0)} sequences"
        ]
    elif metric_id == "lifo_score":
        evidence = [
            f"LIFO correlation rate: {val:.1f}%"
        ]
    elif metric_id == "split_amount_ratio":
        evidence = [
            f"Structuring split factor: {val:.1f}",
            f"Split groups identified: {metadata.get('split_count', 0)}"
        ]
    elif metric_id == "merge_ratio":
        evidence = [
            f"Credits consolidation ratio: {val:.1f}"
        ]
    elif metric_id == "large_to_small_compression":
        evidence = [
            f"Compression index: {val:.1f}% value division",
            f"Avg outflow: ₹{metadata.get('avg_outflow_size', 0.0):,.2f} vs Avg inflow: ₹{metadata.get('avg_inflow_size', 0.0):,.2f}"
        ]
    elif metric_id == "unique_beneficiaries":
        evidence = [
            f"Transfers routed to {val} distinct accounts",
            f"Beneficiary sample: {', '.join(map(str, metadata.get('beneficiaries', [])[:3]))}..."
        ]
    elif metric_id == "unique_senders":
        evidence = [
            f"Transfers consolidated from {val} distinct accounts"
        ]
    elif metric_id == "credit_count":
        evidence = [f"{val} incoming credit transfers recorded"]
    elif metric_id == "debit_count":
        evidence = [f"{val} outgoing debit transfers recorded"]
    elif metric_id == "credit_volume":
        evidence = [f"Cumulative credits: ₹{val:,.2f}"]
    elif metric_id == "debit_volume":
        evidence = [f"Cumulative debits: ₹{val:,.2f}"]
    elif metric_id == "net_flow":
        evidence = [f"Net funds delta remaining: ₹{val:,.2f}"]
    elif metric_id == "average_credit":
        evidence = [f"Mean incoming size: ₹{val:,.2f}"]
    elif metric_id == "average_debit":
        evidence = [f"Mean outgoing size: ₹{val:,.2f}"]
    elif metric_id == "maximum_credit":
        evidence = [f"Single largest incoming credit: ₹{val:,.2f}"]
    elif metric_id == "maximum_debit":
        evidence = [f"Single largest outgoing debit: ₹{val:,.2f}"]
    elif metric_id == "average_holding_time":
        evidence = [f"Incoming funds held for an average of {val} before being transferred"]
    elif metric_id == "balance_retention_percent":
        evidence = [f"Balance retention rate: {val:.1f}% remaining at closure"]
    elif metric_id == "beneficiary_concentration_index":
        evidence = [f"Herfindahl-Hirschman concentration score: {val:.2f}"]
    elif metric_id == "maximum_layer_depth":
        evidence = [f"Maximum downstream path depth: {val} layers"]
    elif metric_id == "longest_money_path":
        evidence = [f"Longest sequential trace path: {val} hops"]
    elif metric_id == "largest_transaction_path":
        evidence = [f"Largest pathway cumulative volume: ₹{val:,.2f}"]
    elif metric_id == "most_connected_account":
        evidence = [f"Primary central hub account: {val}"]
    elif metric_id == "highest_degree":
        evidence = [f"Maximum node transaction degree: {val} edges"]
    elif metric_id == "highest_betweenness":
        evidence = [f"Peak bridging betweenness centrality: {val:.2f}"]
    elif metric_id == "largest_cycle":
        evidence = [f"Circular flow cycle size: {val} nodes"]
    elif metric_id == "graph_density":
        evidence = [f"Graph route density: {val:.2f}%"]
    elif metric_id == "average_degree":
        evidence = [f"Average connectivity: {val:.2f} connections per node"]
    elif metric_id == "critical_bridge_node":
        evidence = [f"Critical network choke point: {val}"]
    elif metric_id == "money_concentration_percent":
        evidence = [f"Concentration in top 3 nodes: {val:.1f}%"]
    elif metric_id == "pattern_count":
        evidence = [f"Total of {val} distinct fraud patterns flagged"]
    elif metric_id == "pattern_diversity":
        evidence = [f"Triggered {val} different classes of patterns"]
    elif metric_id == "pattern_density":
        evidence = [f"Tainted transactions: {val:.1f}% of overall history"]
    elif metric_id == "patterns_per_100_transactions":
        evidence = [f"Normalized frequency: {val:.1f} patterns per 100 tx"]
    elif metric_id == "entity_count":
        evidence = [f"Extracted {val} unique entities from statement descriptions"]
    elif metric_id == "account_count":
        evidence = [f"Number of distinct accounts in graph: {val}"]
    elif metric_id == "merchant_count":
        evidence = [f"Unique merchants identified: {val}"]
    elif metric_id == "upi_count":
        evidence = [f"Unique UPI handles identified: {val}"]
    elif metric_id == "bank_count":
        evidence = [f"Mapped {val} bank destinations via IFSCs"]
    elif metric_id == "investigation_confidence":
        evidence = [f"Analysis confidence rating: {val:.1f}% based on ingestion quality"]
    elif metric_id == "evidence_count":
        evidence = [f"Evidentiary transactions isolated: {val}"]
    elif metric_id == "suspicious_transaction_percent":
        evidence = [f"Highly suspicious transaction percent: {val:.1f}%"]
    elif metric_id == "average_daily_volume":
        evidence = [f"Processed daily flow average: ₹{val:,.2f}/day"]
    elif metric_id == "highest_risk_entity":
        evidence = [f"Entity with peak individual risk: {val}"]
    elif metric_id == "highest_risk_day":
        evidence = [f"Peak risk activity date: {val}"]
    elif metric_id == "highest_risk_transaction":
        evidence = [f"Peak anomalous transaction ID: {val}"]
    elif metric_id == "failed_transaction_metrics":
        evidence = [
            f"Total failed transactions: {val} records",
            f"Failed before success retries: {val_dict.get('failed_before_success', 0)} instances",
            f"Failure rate: {val_dict.get('failure_pct', 0.0):.1f}%"
        ]
    else:
        evidence = [f"Metric value: {val}"]

    # Extract related transactions
    related_txs = res.get("related_transactions", [])
    
    # Calculate related accounts from transactions
    related_accounts = set()
    for tx_id in related_txs:
        for tx in transactions:
            if tx.get("tx_id") == tx_id:
                if tx.get("sender_account"):
                    related_accounts.add(tx["sender_account"])
                if tx.get("receiver_account"):
                    related_accounts.add(tx["receiver_account"])
                    
    # Always ensure primary account is included if transactions exist
    if transactions and transactions[0].get("sender_account"):
        p_acc = transactions[0].get("sender_account") if transactions[0].get("is_debit", True) else transactions[0].get("receiver_account")
        if p_acc and p_acc != "external":
            related_accounts.add(p_acc)

    return {
        "id": metric_id,
        "name": name,
        "category": category,
        "value": value_obj,
        "formatted_value": formatted_value,
        "severity": severity,
        "confidence": int(res.get("confidence", 1.0) * 100) if res.get("confidence", 1.0) <= 1.0 else int(res.get("confidence", 100)),
        "weight": weight,
        "risk_weight": weight,
        "risk_contribution": risk_contribution,
        "description": res.get("description", desc),
        "why_it_matters": why_it_matters,
        "how_calculated": how_calculated,
        "evidence": evidence,
        "related_transactions": list(related_txs),
        "related_accounts": list(related_accounts),
        "metadata": metadata
    }

class FinancialMetricsEngine:
    @staticmethod
    def to_snake_case(name: str) -> str:
        """Convert metric name to snake_case key."""
        return (name.lower()
                .replace(" ", "_")
                .replace("%", "percent")
                .replace("-", "_")
                .replace("/", "_")
                .replace("(", "")
                .replace(")", "")
                .strip())

    @classmethod
    def compute_metrics(cls, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes all registered financial metrics exactly once.
        Returns grouped metrics for transaction behavior, amount, account, graph, and investigation.
        """
        start_time = time.perf_counter()

        transaction_metrics = {}
        amount_metrics = {}
        account_metrics = {}
        graph_metrics = {}
        investigation_metrics = {}
        all_metrics_list = []

        # Prepare default parameters to avoid None references
        txs_input = transactions or []
        entities_input = entities or {}
        graph_input = graph or {"nodes": [], "edges": []}

        # Loop through registered metrics
        for metric in ALL_METRICS:
            try:
                res = metric.compute(txs_input, entities_input, graph_input)
            except Exception as e:
                # Fallback to prevent crash
                res = {
                    "name": metric.name,
                    "category": metric.category,
                    "value": None,
                    "severity": "Low",
                    "description": f"Metric computation error: {str(e)}",
                    "confidence": 0.0,
                    "related_transactions": [],
                    "metadata": {"error": str(e)}
                }

            # Standardize metric to explainable investigation artifact
            standard_res = standardize_metric(res, txs_input)
            all_metrics_list.append(standard_res)
            
            category = standard_res.get("category", "")
            key = standard_res.get("id", "")

            # Group by category mapping
            if category == "Transaction Behaviour":
                target_dict = transaction_metrics
            elif category == "Amount Metrics":
                target_dict = amount_metrics
            elif category == "Account Metrics":
                target_dict = account_metrics
            elif category == "Graph Metrics":
                target_dict = graph_metrics
            else: # "Investigation Metrics" or others
                target_dict = investigation_metrics

            # Store by both standard name and ID key for convenience
            target_dict[standard_res["name"]] = standard_res
            target_dict[key] = standard_res

        end_time = time.perf_counter()
        elapsed_ms = (end_time - start_time) * 1000.0

        # Generate Dashboard KPIs
        major_metrics_mapping = {
            "average_holding_time": ("Average Holding Time", "down"),
            "balance_retention_percent": ("Balance Retention", "down"),
            "transaction_velocity": ("Transaction Velocity", "up"),
            "rapid_money_movement": ("Rapid Money Movement", "up"),
            "pattern_density": ("Pattern Density", "up"),
            "investigation_confidence": ("AI Confidence", "stable"),
            "failed_transaction_metrics": ("Failed Transactions", "up"),
            "split_amount_ratio": ("Split Ratio", "up"),
            "largest_cycle": ("Largest Cycle", "up"),
            "credit_volume": ("Total Inflow", "up")
        }
        
        dashboard_kpis = []
        for m_id, (title, trend) in major_metrics_mapping.items():
            # Find the metric in all categories
            found_metric = None
            for m in all_metrics_list:
                if m.get("id") == m_id:
                    found_metric = m
                    break
            
            if found_metric and found_metric.get("status") != "Not Available":
                dashboard_kpis.append({
                    "id": m_id,
                    "title": title,
                    "value": found_metric.get("formatted_value"),
                    "severity": found_metric.get("severity", "Low"),
                    "trend": trend
                })
            else:
                dashboard_kpis.append({
                    "id": m_id,
                    "title": title,
                    "value": "N/A",
                    "severity": "Low",
                    "trend": trend
                })

        return {
            "transaction_metrics": transaction_metrics,
            "amount_metrics": amount_metrics,
            "account_metrics": account_metrics,
            "graph_metrics": graph_metrics,
            "investigation_metrics": investigation_metrics,
            "all_metrics": all_metrics_list,
            "dashboard_kpis": dashboard_kpis,
            "performance_metadata": {
                "elapsed_time_ms": elapsed_ms,
                "transactions_processed": len(txs_input)
            }
        }
