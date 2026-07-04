from typing import Dict, Any

class GraphContext:
    """
    Builds context related to the money flow graph visualization,
    summarizing node properties and neighboring incoming/outgoing flows.
    """

    @staticmethod
    def build(tool_results: Dict[str, Any]) -> str:
        graph = tool_results.get("graph") or {"nodes": [], "edges": []}
        selected_node_id = tool_results.get("selected_node")

        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])

        context = [
            "### Transaction Graph Topology",
            f"- Total Nodes (Accounts/Entities): {len(nodes)}",
            f"- Total Edges (Transactions): {len(edges)}"
        ]

        # Selected node details
        selected_node_info = None
        if selected_node_id:
            for n in nodes:
                nd = n.get("data", n) if isinstance(n, dict) else {}
                if str(nd.get("id")).lower() == str(selected_node_id).lower() or str(nd.get("account_id")).lower() == str(selected_node_id).lower():
                    selected_node_info = nd
                    break

        if selected_node_info:
            context.append("\n### Selected Node Details")
            for k, v in selected_node_info.items():
                if k not in ["average_holding_time", "money_retention"] or v != "N/A (External)":
                    context.append(f"- {k.replace('_', ' ').title()}: {v}")

            # Direct money flows connected to this node
            incoming = []
            outgoing = []
            for e in edges:
                from_node = e.get("from")
                to_node = e.get("to")
                amount = e.get("amount", 0)
                tx_id = e.get("tx_id", "N/A")
                desc = e.get("description", "")
                
                if str(to_node).lower() == str(selected_node_id).lower():
                    incoming.append(f"  * From {from_node}: ₹{amount:,} (Tx: {tx_id}) - {desc}")
                elif str(from_node).lower() == str(selected_node_id).lower():
                    outgoing.append(f"  * To {to_node}: ₹{amount:,} (Tx: {tx_id}) - {desc}")

            context.append(f"\n### Direct Money Flows for Selected Account")
            context.append(f"- Incoming Connections: {len(incoming)}")
            for flow in incoming[:10]:
                context.append(flow)
            if len(incoming) > 10:
                context.append("  * ... [truncated extra incoming flows]")

            context.append(f"- Outgoing Connections: {len(outgoing)}")
            for flow in outgoing[:10]:
                context.append(flow)
            if len(outgoing) > 10:
                context.append("  * ... [truncated extra outgoing flows]")
        else:
            if selected_node_id:
                context.append(f"\n- Selected Node ID: {selected_node_id} (Not found in current graph details)")

        return "\n".join(context)
