"""
Cycle detection engine for financial transaction networks.
Detects circular money flows using DFS.
"""
from typing import List, Dict, Any
from datetime import datetime


class CycleDetectionEngine:
    """Detect cycles in transaction graphs."""

    @staticmethod
    def detect_cycles(raw_edges: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Detect circular money flows in a list of edges.

        Args:
            raw_edges: List of dicts with keys:
                - from_raw: sender account
                - to_raw: receiver account
                - edge_id: transaction ID
                - amount: transaction amount
                - timestamp: transaction datetime

        Returns:
            Dict with 'cycles' key containing list of detected cycles.
            Each cycle has: cycle_id, accounts, transaction_ids, total_amount, steps, risk_score.
        """
        if not raw_edges:
            return {"cycles": []}

        # Build adjacency graph
        graph = {}
        edge_map = {}
        for edge in raw_edges:
            src = edge["from_raw"]
            dst = edge["to_raw"]

            if src not in graph:
                graph[src] = []
            graph[src].append(dst)

            # Store edge info for cycle reconstruction
            edge_key = (src, dst)
            if edge_key not in edge_map:
                edge_map[edge_key] = []
            edge_map[edge_key].append(edge)

        # DFS to find cycles
        cycles = []
        visited = set()
        rec_stack = set()
        path = []
        path_edges = []

        def dfs(node, start_node, depth=0):
            """DFS to find cycles starting from start_node."""
            if depth > 6:  # Limit cycle length to 6 hops
                return

            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in graph.get(node, []):
                edge = edge_map.get((node, neighbor), [{}])[0]
                path_edges.append(edge)

                if neighbor == start_node and len(path) >= 3:
                    # Found a cycle
                    cycle_accounts = path[:]
                    cycle_edges = path_edges[:-1]  # Exclude last edge back to start

                    # Avoid duplicate cycles
                    cycle_key = tuple(sorted(cycle_accounts))
                    if not any(tuple(sorted(c["accounts"])) == cycle_key for c in cycles):
                        total_amount = sum(e.get("amount", 0) for e in cycle_edges)
                        cycle_id = f"cycle_{len(cycles)}"

                        cycles.append({
                            "cycle_id": cycle_id,
                            "accounts": cycle_accounts,
                            "transaction_ids": [e.get("edge_id") for e in cycle_edges],
                            "total_amount": total_amount,
                            "steps": len(cycle_accounts),
                            "risk_score": min(100, 40 + len(cycle_accounts) * 10)  # Higher risk for longer cycles
                        })

                elif neighbor not in rec_stack:
                    dfs(neighbor, start_node, depth + 1)

                path_edges.pop()

            path.pop()
            rec_stack.discard(node)

        # Find cycles from each node
        for start in graph.keys():
            path = [start]
            path_edges = []
            rec_stack = {start}
            dfs(start, start)

        return {"cycles": cycles}
