"""
Proper cycle detection - find ALL cycles of any length in the dataset.
"""
import sqlite3
import json
from collections import defaultdict
from typing import List, Set, Tuple

def find_cycles_proper(max_hops=10):
    """Find cycles using proper DFS that preserves cycle order."""
    conn = sqlite3.connect("analytics.db")
    cursor = conn.cursor()

    # Build graph
    cursor.execute("SELECT sender_account, receiver_account FROM transactions")
    edges = cursor.fetchall()

    graph = defaultdict(set)
    for src, dst in edges:
        if src != dst:
            graph[src].add(dst)

    print(f"Graph: {len(graph)} nodes, {len(edges)} edges")

    cycles = []
    seen_cycles = set()

    def dfs_cycles(start: str, current: str, path: List[str], visited: Set[str], depth: int):
        """DFS that preserves cycle order."""
        if depth > max_hops:
            return

        for neighbor in graph[current]:
            if neighbor == start and len(path) >= 3:
                # Found a cycle! Don't sort - preserve the path order
                cycle_tuple = tuple(path)
                if cycle_tuple not in seen_cycles:
                    seen_cycles.add(cycle_tuple)
                    cycles.append({
                        "path": path[:],
                        "hops": len(path),
                        "start": start
                    })
            elif neighbor not in visited and depth < max_hops:
                visited.add(neighbor)
                path.append(neighbor)
                dfs_cycles(start, neighbor, path, visited, depth + 1)
                path.pop()
                visited.remove(neighbor)

    # Search from ALL nodes, not just 100
    all_nodes = list(graph.keys())
    print(f"Searching from {len(all_nodes)} nodes...")

    for i, start_node in enumerate(all_nodes):
        if (i + 1) % 2000 == 0:
            print(f"  Progress: {i+1}/{len(all_nodes)}, found {len(cycles)} cycles so far...")

        visited = {start_node}
        dfs_cycles(start_node, start_node, [start_node], visited, 0)

    # Group by hop count
    cycles_by_hops = defaultdict(list)
    for c in cycles:
        cycles_by_hops[c["hops"]].append(c)

    print("\n" + "="*60)
    print("CYCLE DETECTION RESULTS")
    print("="*60)
    total = 0
    for hops in sorted(cycles_by_hops.keys()):
        count = len(cycles_by_hops[hops])
        total += count
        print(f"{hops} hops: {count:,} cycles")

        # Show samples for first few hop counts
        if hops <= 6:
            for i, cycle in enumerate(cycles_by_hops[hops][:3]):
                path_str = " → ".join(cycle["path"][:5])
                if len(cycle["path"]) > 5:
                    path_str += " → ..."
                print(f"    Example: {path_str} → {cycle['path'][0]}")

    print(f"\nTOTAL CYCLES: {total:,}")
    print("="*60)

    return cycles_by_hops

if __name__ == "__main__":
    cycles = find_cycles_proper(max_hops=8)
