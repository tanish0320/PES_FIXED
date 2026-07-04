"""
Real Round-Trip Transaction Detection.
Find money that flows from account A through intermediaries and returns to A.
"""
import sqlite3
import json
from typing import List, Dict, Set, Tuple
from collections import defaultdict
from datetime import datetime


def find_real_round_trips(max_hops=6, min_volume=10000):
    """
    Find actual round-trip paths: A → B → C → ... → A
    where money flows through intermediaries and returns.
    """
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all transactions
    cursor.execute("""
        SELECT sender_account, receiver_account, amount, timestamp
        FROM transactions
        ORDER BY timestamp
    """)

    transactions = cursor.fetchall()

    # Build graph with amounts
    graph = defaultdict(lambda: defaultdict(float))  # graph[from][to] = total_amount
    tx_count = defaultdict(lambda: defaultdict(int))  # tx_count[from][to] = count

    for tx in transactions:
        src = tx['sender_account']
        dst = tx['receiver_account']
        if src != dst:  # Skip self-loops
            graph[src][dst] += tx['amount']
            tx_count[src][dst] += 1

    print(f"Graph: {len(graph)} accounts, {sum(len(v) for v in graph.values())} edges")

    # Find all round-trip paths
    round_trips = []
    found_patterns = set()

    def dfs_find_return(start: str, current: str, path: List[str],
                       total_amount: float, hop_count: int, visited: Set[str]):
        """DFS to find paths that return to start account."""

        if hop_count > max_hops:
            return

        # Check if we can return to start
        if current in graph and start in graph[current]:
            # Found a round-trip!
            path_tuple = tuple(path + [start])
            if path_tuple not in found_patterns:
                found_patterns.add(path_tuple)

                return_amount = graph[current][start]
                total_rt_amount = total_amount + return_amount
                total_rt_txs = sum(tx_count[path[i]][path[i+1]] for i in range(len(path)-1))
                total_rt_txs += tx_count[current][start]

                if total_rt_amount >= min_volume:
                    round_trips.append({
                        'path': list(path_tuple),
                        'hops': len(path_tuple) - 1,
                        'total_amount': total_rt_amount,
                        'transaction_count': total_rt_txs,
                        'intermediaries': path[1:-1] if len(path) > 2 else [],
                        'risk_score': calculate_risk(path_tuple, total_rt_amount, total_rt_txs)
                    })

        # Continue exploring
        if current in graph and len(path) <= max_hops:
            for next_account in graph[current]:
                if next_account not in visited:
                    visited.add(next_account)
                    new_amount = total_amount + graph[current][next_account]
                    dfs_find_return(
                        start, next_account,
                        path + [next_account],
                        new_amount,
                        hop_count + 1,
                        visited
                    )
                    visited.remove(next_account)

    # Search from each account
    all_accounts = list(graph.keys())
    print(f"Searching from {len(all_accounts)} accounts for round-trips...")

    for i, start_account in enumerate(all_accounts):
        if (i + 1) % 2000 == 0:
            print(f"  Progress: {i+1}/{len(all_accounts)}, found {len(round_trips)} patterns...")

        # Look for outgoing edges
        if start_account in graph:
            for first_hop in graph[start_account]:
                visited = {start_account, first_hop}
                dfs_find_return(
                    start_account,
                    first_hop,
                    [start_account, first_hop],
                    graph[start_account][first_hop],
                    2,
                    visited
                )

    conn.close()
    return round_trips


def calculate_risk(path: Tuple, amount: float, tx_count: int) -> float:
    """Calculate risk score for a round-trip pattern."""
    risk = 40  # Base for any round-trip

    # More hops = higher risk (sophisticated money laundering)
    hops = len(path) - 1
    risk += min(35, hops * 5)

    # More transactions = higher risk (repeated pattern)
    risk += min(15, tx_count * 2)

    # High amount = more suspicious
    if amount > 1_000_000:
        risk += 15
    elif amount > 100_000:
        risk += 10

    # Duplicate intermediaries = very suspicious
    intermediaries = path[1:-1]
    if len(intermediaries) != len(set(intermediaries)):
        risk += 10

    return min(100, int(risk))


def analyze_round_trips(round_trips: List[Dict]):
    """Analyze and format results."""
    if not round_trips:
        return {}

    # Group by hop count
    by_hops = defaultdict(list)
    for rt in round_trips:
        by_hops[rt['hops']].append(rt)

    print("\n" + "="*70)
    print("ROUND-TRIP FRAUD DETECTION RESULTS")
    print("="*70)
    print(f"\nTotal patterns found: {len(round_trips)}")
    print("\nBreakdown by hops:")
    for hops in sorted(by_hops.keys()):
        count = len(by_hops[hops])
        print(f"  {hops} hops: {count} patterns")

    # Find high-risk
    high_risk = [rt for rt in round_trips if rt['risk_score'] >= 70]
    medium_risk = [rt for rt in round_trips if 50 <= rt['risk_score'] < 70]

    print(f"\nRisk Distribution:")
    print(f"  High-risk (≥70): {len(high_risk)}")
    print(f"  Medium-risk (50-69): {len(medium_risk)}")
    print(f"  Low-risk (<50): {len(round_trips) - len(high_risk) - len(medium_risk)}")

    # Top patterns by amount
    print(f"\nTop 5 Patterns by Amount:")
    for i, rt in enumerate(sorted(round_trips, key=lambda x: x['total_amount'], reverse=True)[:5], 1):
        path_str = " → ".join(rt['path'][:6]) + ("..." if len(rt['path']) > 6 else "")
        print(f"\n  {i}. {path_str}")
        print(f"     Hops: {rt['hops']}, Amount: ₹{rt['total_amount']/1e6:.1f}M, TXs: {rt['transaction_count']}, Risk: {rt['risk_score']}%")

    return {
        'total': len(round_trips),
        'high_risk': len(high_risk),
        'medium_risk': len(medium_risk),
        'by_hops': dict(by_hops),
        'patterns': round_trips
    }


if __name__ == "__main__":
    print("Finding real round-trip transactions...")
    round_trips = find_real_round_trips(max_hops=6, min_volume=10000)
    results = analyze_round_trips(round_trips)

    # Save to JSON for inspection
    with open('round_trips_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nResults saved to round_trips_results.json")
