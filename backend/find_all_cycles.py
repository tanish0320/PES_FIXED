"""
Exhaustive cycle detection - check entire dataset for all cycles up to 8 hops.
"""
import sqlite3
from typing import List, Set, Dict
from collections import defaultdict

def find_all_cycles(max_depth=8):
    """Find ALL cycles in the dataset up to max_depth."""
    conn = sqlite3.connect("analytics.db")
    cursor = conn.cursor()

    # Fetch all transactions
    cursor.execute("SELECT sender_account, receiver_account FROM transactions")
    edges = cursor.fetchall()

    # Build adjacency list
    graph = defaultdict(set)
    for src, dst in edges:
        if src != dst:  # Skip self-loops
            graph[src].add(dst)

    print(f"Total nodes: {len(graph)}")
    print(f"Total edges: {len(edges)}")

    cycles_by_length = defaultdict(list)
    found_cycle_keys = set()

    def dfs(start: str, current: str, path: List[str], visited: Set[str]):
        """DFS to find cycles."""
        if len(path) > max_depth:
            return

        for neighbor in graph[current]:
            if neighbor == start and len(path) >= 2:
                # Found a cycle
                cycle_key = tuple(sorted(path))
                if cycle_key not in found_cycle_keys:
                    found_cycle_keys.add(cycle_key)
                    cycles_by_length[len(path)].append(path[:])
            elif neighbor not in visited and len(path) < max_depth:
                visited.add(neighbor)
                path.append(neighbor)
                dfs(start, neighbor, path, visited)
                path.pop()
                visited.remove(neighbor)

    # Search from all nodes
    all_nodes = list(graph.keys())
    print(f"\nSearching from {len(all_nodes)} nodes...")

    for i, start in enumerate(all_nodes):
        if i % 1000 == 0:
            print(f"  Progress: {i}/{len(all_nodes)}")

        visited = {start}
        dfs(start, start, [start], visited)

    conn.close()

    # Print results
    print("\n" + "="*50)
    print("CYCLE RESULTS")
    print("="*50)
    total = 0
    for length in sorted(cycles_by_length.keys()):
        count = len(cycles_by_length[length])
        total += count
        print(f"{length} hops: {count} cycles")
        if length <= 5 and count <= 5:
            for cycle in cycles_by_length[length][:5]:
                print(f"    {' → '.join(cycle)} → {cycle[0]}")

    print(f"\nTOTAL: {total} cycles found")
    return cycles_by_length

if __name__ == "__main__":
    cycles = find_all_cycles(max_depth=8)
