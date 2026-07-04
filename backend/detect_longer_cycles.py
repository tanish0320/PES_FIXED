"""
Re-run cycle detection with longer max_depth to find 4-7 hop cycles.
"""
import sqlite3
import json
from typing import List, Set, Tuple
from datetime import datetime

def detect_longer_cycles(max_depth=7, max_nodes=200):
    """Detect cycles up to max_depth hops."""
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Fetch all transactions
    cursor.execute("SELECT sender_account, receiver_account, amount FROM transactions")
    edges = cursor.fetchall()

    # Build adjacency graph
    graph = {}
    for edge in edges:
        src = edge['sender_account']
        dst = edge['receiver_account']

        if src == dst:  # Skip self-loops
            continue

        if src not in graph:
            graph[src] = set()
        graph[src].add(dst)

    print(f"Graph built: {len(graph)} nodes")

    # Find cycles using DFS
    cycles = []
    found_cycle_keys = set()

    def find_cycles_from(start: str) -> List[List]:
        """DFS to find cycles starting from a node."""
        found = []

        def dfs(node: str, path: List[str], depth: int) -> None:
            if depth > max_depth:
                return

            for neighbor in graph.get(node, set()):
                if neighbor == start and len(path) >= 2:
                    # Found a cycle back to start
                    cycle_key = tuple(sorted(path))
                    if cycle_key not in found_cycle_keys:
                        found.append(path[:])
                        found_cycle_keys.add(cycle_key)
                elif neighbor not in path and depth < max_depth:
                    path.append(neighbor)
                    dfs(neighbor, path, depth + 1)
                    path.pop()

        dfs(start, [start], 0)
        return found

    # Check nodes with out-degree
    nodes_to_check = list(graph.keys())[:max_nodes]
    print(f"Checking {len(nodes_to_check)} nodes for cycles...")

    for i, start_node in enumerate(nodes_to_check):
        if i % 50 == 0:
            print(f"  Processed {i}/{len(nodes_to_check)}")

        found = find_cycles_from(start_node)
        for cycle_path in found:
            # Get edge amounts for this cycle
            total_amount = 0
            for j in range(len(cycle_path)):
                src = cycle_path[j]
                dst = cycle_path[(j + 1) % len(cycle_path)]
                # Find an edge from src to dst
                cursor.execute(
                    "SELECT amount FROM transactions WHERE sender_account = ? AND receiver_account = ? LIMIT 1",
                    (src, dst)
                )
                result = cursor.fetchone()
                if result:
                    total_amount += result['amount']

            hop_count = len(cycle_path)
            cycles.append({
                "cycle_id": f"cycle_{len(cycles)}",
                "accounts": cycle_path,
                "amount": total_amount,
                "hop_count": hop_count,
                "confidence": 70.0,  # Default confidence
                "detected_at": datetime.now().isoformat()
            })

    conn.close()
    return cycles

if __name__ == "__main__":
    print("Detecting longer cycles (up to 7 hops)...")
    cycles = detect_longer_cycles(max_depth=7, max_nodes=300)

    print(f"\nFound {len(cycles)} total cycles")

    # Group by hop count
    hop_dist = {}
    for c in cycles:
        hops = c['hop_count']
        hop_dist[hops] = hop_dist.get(hops, 0) + 1

    print("\nCycles by hop count:")
    for hops in sorted(hop_dist.keys()):
        print(f"  {hops} hops: {hop_dist[hops]} cycles")

    # Save to database
    conn = sqlite3.connect("analytics.db")
    cursor = conn.cursor()

    # Clear old cycles
    cursor.execute("DELETE FROM cycles")

    # Insert new cycles
    for c in cycles:
        cursor.execute("""
            INSERT INTO cycles (cycle_id, accounts, transaction_ids, amount, hop_count, confidence, detected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            c['cycle_id'],
            json.dumps(c['accounts']),
            json.dumps([]),  # Empty transaction_ids for now
            c['amount'],
            c['hop_count'],
            c['confidence'],
            c['detected_at']
        ))

    conn.commit()
    conn.close()

    print(f"\nSaved {len(cycles)} cycles to database")
