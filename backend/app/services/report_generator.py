from typing import List, Dict, Any
from datetime import datetime

class ReportGenerator:
    @staticmethod
    def format_inr(number: float) -> str:
        try:
            val_int = int(number)
            s = str(val_int)
            if len(s) <= 3:
                return f"\u20b9{s}"
            last_three = s[-3:]
            other_parts = s[:-3]
            groups = []
            while other_parts:
                groups.append(other_parts[-2:])
                other_parts = other_parts[:-2]
            groups.reverse()
            formatted = ",".join(groups) + "," + last_three
            return f"\u20b9{formatted}"
        except Exception:
            return f"\u20b9{number:,.2f}"

    @classmethod
    def generate_report(cls, case: Dict[str, Any], transactions: List[Dict[str, Any]], 
                        patterns_data: Dict[str, Any], entities: Dict[str, Any], 
                        graph: Dict[str, Any], timeline: Any, 
                        parser_stats: Dict[str, Any], metrics: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Generate a comprehensive, analyst-ready investigation report.
        """
        if metrics is None:
            from app.engines.financial_metrics.metrics_engine import FinancialMetricsEngine
            entities_copy = dict(entities)
            entities_copy["patterns"] = patterns_data.get("patterns", [])
            metrics = FinancialMetricsEngine.compute_metrics(transactions, entities_copy, graph)

        account_id = case.get("account_id", "Unknown")
        risk_score = case.get("risk_score", 0.0)
        risk_level = case.get("risk_level", "LOW")
        
        # Calculate money flow metrics
        total_inflow = 0.0
        total_outflow = 0.0
        unique_counterparties = set()
        
        beneficiaries_map = {} # counterparty -> {total_received, tx_count}

        for tx in transactions:
            if tx.get("is_internal_transfer", False):
                continue
            amount = tx.get("amount", 0.0)
            is_debit = tx.get("is_debit", True)
            
            # Simple counterparty extraction
            desc = tx.get("description", "").upper()
            counterparty = "unknown"
            for word in desc.split():
                if "@" in word:
                    counterparty = word
                    break
            if counterparty == "unknown" and "NEFT-" in desc:
                parts = desc.split("-")
                if len(parts) > 2:
                    counterparty = parts[2]
            if counterparty == "unknown" and "IMPS/" in desc:
                parts = desc.split("/")
                if len(parts) > 3:
                    counterparty = parts[3]
            if counterparty == "unknown":
                counterparty = desc[:15]

            unique_counterparties.add(counterparty)

            if is_debit:
                total_outflow += amount
                if counterparty not in beneficiaries_map:
                    beneficiaries_map[counterparty] = {"total_received": 0.0, "tx_count": 0}
                beneficiaries_map[counterparty]["total_received"] += amount
                beneficiaries_map[counterparty]["tx_count"] += 1
            else:
                total_inflow += amount

        net_flow = total_inflow - total_outflow
        primary_flow_direction = "inbound" if total_inflow > total_outflow else "outbound"

        # Format beneficiaries list
        top_beneficiaries = []
        for account, data in beneficiaries_map.items():
            top_beneficiaries.append({
                "account": account,
                "name": account,
                "total_received": data["total_received"],
                "tx_count": data["tx_count"]
            })
        top_beneficiaries.sort(key=lambda x: x["total_received"], reverse=True)
        top_beneficiaries = top_beneficiaries[:5]

        # Top 10 High Risk / Contribution transactions
        high_risk_txs = sorted(transactions, key=lambda x: x.get("amount", 0.0), reverse=True)[:10]

        # Gather pattern details
        patterns = patterns_data.get("patterns", [])
        pattern_names = [p["name"] for p in patterns]
        
        # Determine account holder name
        holder_names = [n["value"] for n in entities.get("names", [])]
        holder_name = holder_names[0] if holder_names else "Account Holder"

        # Generate Executive Summary Text using modular financial metrics (AI Summary)
        holding_time = metrics["account_metrics"]["average_holding_time"]["value"]
        retention_pct = metrics["account_metrics"]["balance_retention_percent"]["value"]
        ben_count = metrics["account_metrics"]["unique_beneficiaries"]["value"]
        velocity_val = metrics["transaction_metrics"]["transaction_velocity"]["value"]
        tx_per_day = velocity_val.get("tx_per_day", 0.0) if isinstance(velocity_val, dict) else 0.0
        
        velocity_level = "high" if tx_per_day >= 10 else "moderate" if tx_per_day >= 3 else "low"
        
        risk_indicator = "potential layering"
        if risk_score >= 80:
            risk_indicator = "severe layering and money laundering risk"
        elif risk_score >= 60:
            risk_indicator = "suspicious pass-through routing/layering"
        elif risk_score >= 40:
            risk_indicator = "moderate layering indicators"
        else:
            risk_indicator = "low anomaly profile"

        files_count = len(case.get("files_uploaded", []))
        if files_count > 1:
            exec_summary = (
                f"The unified investigation correlates {files_count} bank statements. "
                f"The merged network exhibits {velocity_level} transaction velocity with an average holding time of {holding_time}. "
                f"Funds are routed to {ben_count} unique beneficiaries while retaining only {retention_pct:.1f}% of incoming balances, "
                f"indicating {risk_indicator} across statements (overall risk score is {int(risk_score)}/100, flagged as {risk_level.upper()})."
            )
        else:
            exec_summary = (
                f"The account exhibits {velocity_level} transaction velocity with an average holding time of only {holding_time}. "
                f"Funds are rapidly distributed to {ben_count} beneficiaries while retaining only {retention_pct:.1f}% of incoming balances, "
                f"indicating {risk_indicator} (overall investigation risk score is {int(risk_score)}/100, flagged as {risk_level.upper()})."
            )


        # Graph summary details
        nodes_list = graph.get("nodes", []) if graph else []
        edges_list = graph.get("edges", []) if graph else []
        node_types_count = {}
        for n in nodes_list:
            nt = n.get("node_type", "account")
            node_types_count[nt] = node_types_count.get(nt, 0) + 1

        graph_summary = {
            "total_nodes": len(nodes_list),
            "total_edges": len(edges_list),
            "node_types": node_types_count
        }

        # Build human-readable explanations list
        explanations = []
        if risk_score >= 80:
            explanations.append("Critical risk score triggered by multiple high-severity behavioral patterns.")
        for p in patterns:
            explanations.append(f"Pattern detected: {p['name']} - {p['description']}")
        if total_inflow > 1000000:
            explanations.append(f"High volume inbound flow: {cls.format_inr(total_inflow)} received.")
        if len(transactions) > 100:
            explanations.append(f"High transaction frequency: {len(transactions)} events processed.")
        if not explanations:
            explanations.append("No critical risk factors identified. Transaction flows appear standard.")

        # Risk explanation narrative
        risk_explanation = (
            f"This account has been flagged at {risk_level} risk due to the presence of {len(patterns)} major suspicious patterns. "
            f"The primary driver of risk is the fund routing signature: inbound transfers are processed and sent to various beneficiaries "
            f"or withdrawn in cash within short intervals. This pattern is commonly associated with mule accounts or layering intermediaries."
        )

        # Recommended Next Steps
        next_steps = [
            "Initiate verification of account holder credentials and KYC records.",
            "Obtain statements of top beneficiary accounts to trace downstream money flow.",
            f"Cross-reference UPI IDs and IFSC codes with other active cases ({len(entities.get('upi_ids', []))} UPI IDs linked)."
        ]
        if "Circular Money Flow" in pattern_names:
            next_steps.append("Request reversal details for potential circular transactions.")
        if "Cash Intensive Behaviour" in pattern_names:
            next_steps.append("Audit nearby ATM location feeds for the identified serial withdrawal dates.")

        report = {
            "executive_summary": exec_summary,
            "investigation_risk": {
                "score": risk_score,
                "level": risk_level,
                "explanation": explanations
            },
            "detected_patterns": patterns,
            "risk_explanation": risk_explanation,
            "timeline": timeline.get("case_timeline", [])[:50] if isinstance(timeline, dict) else timeline[:50],
            "timelines": timeline if isinstance(timeline, dict) else {"case_timeline": timeline},
            "money_flow_summary": {
                "total_inflow": total_inflow,
                "total_outflow": total_outflow,
                "net_flow": net_flow,
                "unique_counterparties": len(unique_counterparties),
                "primary_flow_direction": primary_flow_direction
            },
            "high_risk_transactions": high_risk_txs,
            "top_beneficiaries": top_beneficiaries,
            "extracted_entities": entities,
            "parser_statistics": parser_stats,
            "graph_summary": graph_summary,
            "recommended_next_steps": next_steps,
            "financial_metrics": metrics,
            "files_uploaded": case.get("files_uploaded", [])
        }

        return report
