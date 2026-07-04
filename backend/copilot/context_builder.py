from typing import Dict, Any, List, Optional
import json

class ContextBuilder:
    """
    Builds LLM context from structured JSON data.
    Database agnostic. Limits context size intelligently based on classified intent.
    Never exceeds 10 transactions or 5 patterns to avoid huge prompts.
    """

    @staticmethod
    def build_context(raw_context: Dict[str, Any], intent: str, message: str) -> str:
        # Safeguards for missing keys
        case = raw_context.get("case") or {}
        patterns = raw_context.get("patterns") or []
        transactions = raw_context.get("transactions") or []
        timeline = raw_context.get("timeline") or []
        graph = raw_context.get("graph") or raw_context.get("graph_summary") or {"nodes": [], "edges": []}
        entities = raw_context.get("entities") or []
        report_summary = raw_context.get("report_summary") or ""
        selected_node_id = raw_context.get("selected_node")

        context_lines = []

        # 1. Add Case Metadata (Always present for grounding)
        context_lines.append("### CASE METADATA")
        context_lines.append(f"- Case ID: {case.get('case_id', 'N/A')}")
        context_lines.append(f"- Target Account: {case.get('account_id', 'N/A')}")
        context_lines.append(f"- Risk Score: {case.get('risk_score', '0')}/100")
        context_lines.append(f"- Risk Level: {case.get('risk_level', 'LOW')}")
        context_lines.append(f"- Status: {case.get('status', 'NEW')}")
        context_lines.append(f"- Source File: {case.get('source_file', 'N/A')}")
        context_lines.append("")

        # 2. Add Selected Node Context if Graph page
        selected_node_info = None
        if selected_node_id:
            # Look up node in graph
            nodes = graph.get("nodes", [])
            for node in nodes:
                # Node can be flat or have a data nested dict (Cytoscape style)
                nd = node.get("data", node) if isinstance(node, dict) else {}
                if str(nd.get("id")).lower() == str(selected_node_id).lower() or str(nd.get("account_id")).lower() == str(selected_node_id).lower():
                    selected_node_info = nd
                    break
            
            if selected_node_info:
                context_lines.append("### SELECTED GRAPH NODE DETAILS")
                for k, v in selected_node_info.items():
                    if k not in ["average_holding_time", "money_retention"] or v != "N/A (External)":
                        context_lines.append(f"- {k.replace('_', ' ').title()}: {v}")
                context_lines.append("")

        # 3. Intent-Specific Slicing
        if intent == "GRAPH_EXPLANATION":
            # Graph Stats
            nodes = graph.get("nodes", [])
            edges = graph.get("edges", [])
            context_lines.append("### GRAPH TOPOLOGY")
            context_lines.append(f"- Total Nodes: {len(nodes)}")
            context_lines.append(f"- Total Connected Edges: {len(edges)}")
            
            if selected_node_id:
                # Find direct flows (inflow & outflow edges connected to selected_node_id)
                incoming_flows = []
                outgoing_flows = []
                for edge in edges:
                    from_node = edge.get("from")
                    to_node = edge.get("to")
                    amount = edge.get("amount", 0)
                    tx_id = edge.get("tx_id", "N/A")
                    desc = edge.get("description", "")
                    
                    if str(to_node).lower() == str(selected_node_id).lower():
                        incoming_flows.append(f"  * From {from_node}: ₹{amount:,} (Tx: {tx_id}) - {desc}")
                    elif str(from_node).lower() == str(selected_node_id).lower():
                        outgoing_flows.append(f"  * To {to_node}: ₹{amount:,} (Tx: {tx_id}) - {desc}")

                context_lines.append("### DIRECT MONEY FLOWS")
                context_lines.append(f"- Incoming Flows count: {len(incoming_flows)}")
                for f in incoming_flows[:10]:
                    context_lines.append(f)
                if len(incoming_flows) > 10:
                    context_lines.append("  * ... [truncated additional incoming flows]")
                
                context_lines.append(f"- Outgoing Flows count: {len(outgoing_flows)}")
                for f in outgoing_flows[:10]:
                    context_lines.append(f)
                if len(outgoing_flows) > 10:
                    context_lines.append("  * ... [truncated additional outgoing flows]")
            context_lines.append("")

        elif intent == "REPORT_SUMMARY":
            context_lines.append("### EXECUTIVE REPORT SUMMARY")
            context_lines.append(report_summary or "No executive report summary has been generated for this case.")
            context_lines.append("")

        elif intent == "PATTERN_EXPLANATION":
            context_lines.append("### DETECTED SUSPICIOUS BEHAVIORAL PATTERNS")
            # If message mentions a pattern, prioritize it
            matched_patterns = []
            for p in patterns:
                name = p.get("name", "").lower()
                desc = p.get("description", "").lower()
                # Simple keyword match
                if any(w in message.lower() for w in name.split()) or any(w in message.lower() for w in desc.split()):
                    matched_patterns.insert(0, p) # Put matches first
                else:
                    matched_patterns.append(p)

            # Limit to 5 patterns
            for p in matched_patterns[:5]:
                context_lines.append(f"- Pattern: {p.get('name', 'N/A')} (Severity: {p.get('severity', 'MEDIUM')})")
                context_lines.append(f"  Description: {p.get('description', '')}")
                context_lines.append(f"  Risk Impact: {p.get('risk_contribution', 'N/A')}")
            
            # Add transactions matching pattern
            context_lines.append("")
            context_lines.append("### ASSOCIATED TRANSACTIONS")
            pattern_tx_ids = set()
            for p in matched_patterns[:5]:
                for tid in p.get("associated_transactions", []):
                    pattern_tx_ids.add(tid)
            
            associated_txs = [t for t in transactions if t.get("tx_id") in pattern_tx_ids]
            # Limit to top 10
            for tx in sorted(associated_txs, key=lambda x: float(x.get("amount", 0)), reverse=True)[:10]:
                context_lines.append(f"- {tx.get('tx_id')}: {tx.get('date')} | ₹{tx.get('amount'):,} | {tx.get('channel')} | {tx.get('description')}")
            context_lines.append("")

        elif intent == "TIMELINE_SUMMARY":
            context_lines.append("### CHRONOLOGICAL INVESTIGATION TIMELINE")
            # Limit timeline to 15 key events
            sorted_timeline = sorted(timeline, key=lambda x: (x.get("date", ""), x.get("time", "")))
            for evt in sorted_timeline[:15]:
                flag_str = " [FLAGGED]" if evt.get("risk_flag") else ""
                context_lines.append(f"- {evt.get('date')} {evt.get('time')} | {evt.get('event')}: {evt.get('description')}{flag_str}")
            if len(sorted_timeline) > 15:
                context_lines.append(f"- ... [{len(sorted_timeline) - 15} additional timeline events truncated]")
            context_lines.append("")

        elif intent in ["TRANSACTION_LOOKUP", "CASE_EXPLANATION", "INVESTIGATION_SUMMARY", "REPORT_GENERATION"]:
            # Load suspicious transactions
            suspicious_txs = [t for t in transactions if float(t.get("risk_score", 0)) >= 60 or t.get("risk_flag")]
            if not suspicious_txs:
                suspicious_txs = transactions

            # Sort by risk score, then amount descending
            suspicious_txs = sorted(suspicious_txs, key=lambda x: (float(x.get("risk_score", 0)), float(x.get("amount", 0))), reverse=True)

            context_lines.append("### TOP SUSPICIOUS TRANSACTIONS")
            for tx in suspicious_txs[:10]:
                context_lines.append(f"- {tx.get('tx_id')}: {tx.get('date')} | ₹{tx.get('amount'):,} | {tx.get('channel')} | {tx.get('description')} (Risk Score: {tx.get('risk_score', 0)})")
            if len(suspicious_txs) > 10:
                context_lines.append(f"- ... [{len(suspicious_txs) - 10} additional transactions truncated]")
            
            # Load patterns
            context_lines.append("")
            context_lines.append("### SUSPICIOUS PATTERNS")
            for p in patterns[:5]:
                context_lines.append(f"- {p.get('name')}: {p.get('description')} (Severity: {p.get('severity')})")
            
            if intent in ["INVESTIGATION_SUMMARY", "REPORT_GENERATION"]:
                context_lines.append("")
                context_lines.append("### EXECUTIVE SUMMARY")
                context_lines.append(report_summary or "No summary available.")
            context_lines.append("")

        elif intent == "ENTITY_LOOKUP":
            context_lines.append("### EXTRACTED IDENTIFIED ENTITIES")
            # If entities are not structured as a list, convert or summarize them
            if isinstance(entities, dict):
                for k, v in entities.items():
                    context_lines.append(f"- {k.replace('_', ' ').title()}:")
                    for val in v[:10]:
                        if isinstance(val, dict):
                            context_lines.append(f"  * {val.get('value')} ({val.get('confidence', '')})")
                        else:
                            context_lines.append(f"  * {val}")
            elif isinstance(entities, list):
                for ent in entities[:15]:
                    context_lines.append(f"- {ent.get('value')} ({ent.get('type')}) - Context: {ent.get('context', 'N/A')}")
            context_lines.append("")

        return "\n".join(context_lines)
