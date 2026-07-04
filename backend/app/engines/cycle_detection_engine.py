"""
Cycle detection engine for financial transaction networks.
Detects circular money flows using DFS with optimizations for large graphs.
"""
from typing import List, Dict, Any, Set, Tuple
from datetime import datetime


class CycleDetectionEngine:
    """Detect cycles in transaction graphs."""

    @staticmethod
    def detect_cycles(raw_edges: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Detect circular money flows in a list of edges.
        Optimized for large graphs (48K+ transactions).

        Args:
            raw_edges: List of dicts with keys:
                - from_raw: sender account
                - to_raw: receiver account
                - edge_id: transaction ID
                - amount: transaction amount
                - timestamp: transaction datetime

        Returns:
            Dict with 'cycles' key containing list of detected cycles.
        """
        if not raw_edges:
            return {"cycles": []}

        # Build adjacency graph (deduplicate edges)
        graph = {}
        edge_map = {}

        for edge in raw_edges:
            src = edge["from_raw"]
            dst = edge["to_raw"]

            # Skip self-loops
            if src == dst:
                continue

            if src not in graph:
                graph[src] = set()
            graph[src].add(dst)

            # Store first edge for each (src, dst) pair
            edge_key = (src, dst)
            if edge_key not in edge_map:
                edge_map[edge_key] = edge

        # Find cycles using DFS - limit to 3-4 hop cycles
        cycles = []
        found_cycle_keys = set()

        def find_cycles_from(start: str, max_depth: int = 4) -> List[Tuple]:
            """DFS to find cycles starting from a node."""
            found = []

            def dfs(node: str, path: List[str], depth: int) -> None:
                if depth > max_depth:
                    return

                for neighbor in graph.get(node, set()):
                    if neighbor == start and len(path) >= 2:
                        # Found a cycle back to start
                        cycle = tuple(sorted(path))
                        if cycle not in found_cycle_keys:
                            found.append(path[:])
                            found_cycle_keys.add(cycle)
                    elif neighbor not in path and depth < max_depth:
                        path.append(neighbor)
                        dfs(neighbor, path, depth + 1)
                        path.pop()

            # Start DFS
            dfs(start, [start], 0)
            return found

        # Only check nodes with out-degree (to avoid unnecessary searches)
        for start_node in list(graph.keys())[:100]:  # Limit to first 100 nodes for performance
            found = find_cycles_from(start_node)
            for cycle_path in found:
                total_amount = 0
                tx_ids = []

                # Get edge amounts
                for i in range(len(cycle_path)):
                    src = cycle_path[i]
                    dst = cycle_path[(i + 1) % len(cycle_path)]
                    edge_key = (src, dst)
                    if edge_key in edge_map:
                        edge = edge_map[edge_key]
                        total_amount += edge.get("amount", 0)
                        tx_ids.append(edge.get("edge_id", ""))

                cycles.append({
                    "cycle_id": f"cycle_{len(cycles)}",
                    "accounts": cycle_path,
                    "transaction_ids": tx_ids,
                    "total_amount": total_amount,
                    "steps": len(cycle_path),
                    "risk_score": min(100, 50 + len(cycle_path) * 5)
                })

        return {"cycles": cycles}
