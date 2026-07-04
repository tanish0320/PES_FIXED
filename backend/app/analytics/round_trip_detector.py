"""
Round-Trip Transaction Detection - Fraud Pattern Analysis.

Detects money that flows from an account through intermediaries and returns,
indicating potential fraud, money laundering, or account manipulation.
"""
import sqlite3
import json
from typing import List, Dict, Set, Tuple
from collections import defaultdict
from datetime import datetime, timedelta


class RoundTripDetector:
    """Detect round-trip transactions for fraud investigation."""

    def __init__(self, db_path: str = "analytics.db"):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    def find_round_trips(self, max_intermediaries=6, time_window_days=90) -> List[Dict]:
        """
        Find round-trip transactions where money goes out and comes back.

        Args:
            max_intermediaries: Maximum hops between source and return
            time_window_days: Window to look for return transactions

        Returns:
            List of round-trip patterns found
        """
        # Get all transactions sorted by timestamp
        self.cursor.execute("""
            SELECT transaction_id, sender_account, receiver_account, amount, timestamp
            FROM transactions
            ORDER BY timestamp
        """)
        transactions = self.cursor.fetchall()

        # Build forward and backward edges
        outgoing = defaultdict(list)  # account -> [(receiver, amount, tx_id, timestamp)]
        incoming = defaultdict(list)  # account -> [(sender, amount, tx_id, timestamp)]

        for tx in transactions:
            outgoing[tx['sender_account']].append({
                'account': tx['receiver_account'],
                'amount': tx['amount'],
                'tx_id': tx['transaction_id'],
                'timestamp': datetime.fromisoformat(tx['timestamp'])
            })
            incoming[tx['receiver_account']].append({
                'account': tx['sender_account'],
                'amount': tx['amount'],
                'tx_id': tx['transaction_id'],
                'timestamp': datetime.fromisoformat(tx['timestamp'])
            })

        round_trips = []

        # For each account, find outgoing money that comes back
        for source_account in outgoing.keys():
            for outgoing_tx in outgoing[source_account]:
                receiver = outgoing_tx['account']
                outgoing_time = outgoing_tx['timestamp']
                time_limit = outgoing_time + timedelta(days=time_window_days)

                # Find paths from receiver back to source (or related accounts)
                paths = self._find_return_paths(
                    receiver,
                    source_account,
                    outgoing_time,
                    time_limit,
                    max_intermediaries
                )

                for path in paths:
                    # Reconstruct full round-trip
                    full_path = [source_account] + path + [source_account]

                    # Calculate total amounts at each hop
                    amounts = [outgoing_tx['amount']]
                    for i in range(1, len(full_path) - 1):
                        # Get amount for this hop
                        amounts.append(outgoing_tx['amount'])  # Simplified - track main flow

                    # Check if it's a significant pattern
                    if len(full_path) >= 3:  # At least one intermediary
                        round_trips.append({
                            'source': source_account,
                            'path': full_path,
                            'intermediaries': full_path[1:-1],
                            'hops': len(full_path) - 1,
                            'initial_amount': outgoing_tx['amount'],
                            'duration_days': (time_limit - outgoing_time).days,
                            'transaction_ids': [outgoing_tx['tx_id']],  # Would be full path TXs in production
                            'risk_score': self._calculate_risk(full_path, outgoing_tx['amount']),
                            'pattern_type': 'round_trip'
                        })

        self.conn.close()
        return round_trips

    def _find_return_paths(
        self,
        current: str,
        target: str,
        start_time: datetime,
        end_time: datetime,
        max_depth: int,
        path: List[str] = None,
        visited: Set[str] = None
    ) -> List[List[str]]:
        """DFS to find paths back to target account."""
        if path is None:
            path = []
        if visited is None:
            visited = set()

        paths = []

        # Base case: found target
        if current == target and len(path) > 0:
            return [path[:]]

        # Limit depth
        if len(path) >= max_depth:
            return []

        visited.add(current)

        # Explore neighbors (who this account sends money to)
        for next_tx in outgoing.get(current, []):
            neighbor = next_tx['account']
            if neighbor not in visited:
                path.append(neighbor)
                found = self._find_return_paths(
                    neighbor, target, start_time, end_time,
                    max_depth, path, visited
                )
                paths.extend(found)
                path.pop()

        visited.remove(current)
        return paths

    def _calculate_risk(self, path: List[str], amount: float) -> float:
        """Calculate risk score for a round-trip pattern."""
        risk = 50  # Base risk for any round-trip

        # More hops = higher risk (more money laundering indicators)
        risk += min(30, len(path) * 5)

        # Duplicate intermediaries = suspicious
        if len(set(path[1:-1])) < len(path) - 2:
            risk += 15

        # High amount = more concerning
        if amount > 1_000_000:
            risk += 20
        elif amount > 100_000:
            risk += 10

        return min(100, risk)

    def detect_money_loops(self) -> List[Dict]:
        """Detect circular money flows between specific accounts."""
        self.cursor.execute("""
            SELECT sender_account, receiver_account, COUNT(*) as tx_count, SUM(amount) as total_amount
            FROM transactions
            GROUP BY sender_account, receiver_account
            HAVING COUNT(*) > 2
            ORDER BY total_amount DESC
        """)

        loops = []
        for row in self.cursor.fetchall():
            sender = row['sender_account']
            receiver = row['receiver_account']

            # Check if reverse flow exists (A→B and B→A)
            self.cursor.execute("""
                SELECT COUNT(*) as reverse_count, SUM(amount) as reverse_amount
                FROM transactions
                WHERE sender_account = ? AND receiver_account = ?
            """, (receiver, sender))

            reverse = self.cursor.fetchone()
            if reverse['reverse_count'] > 0:
                loops.append({
                    'account_a': sender,
                    'account_b': receiver,
                    'forward_transactions': row['tx_count'],
                    'forward_amount': row['total_amount'],
                    'backward_transactions': reverse['reverse_count'],
                    'backward_amount': reverse['reverse_amount'],
                    'risk_score': min(100, 60 + (row['tx_count'] + reverse['reverse_count'])),
                    'pattern_type': 'mutual_loop',
                    'confidence': 0.85
                })

        self.conn.close()
        return loops


def detect_all_fraud_patterns():
    """Run complete fraud pattern detection."""
    detector = RoundTripDetector()

    print("=" * 60)
    print("FRAUD PATTERN DETECTION - ROUND-TRIP ANALYSIS")
    print("=" * 60)

    # For now, focus on mutual loops (which we know exist)
    print("\nDetecting mutual money loops (A→B and B→A patterns)...")
    loops = detector.detect_money_loops()

    print(f"Found {len(loops)} suspicious mutual loops")

    # Group by risk
    high_risk = [l for l in loops if l['risk_score'] >= 70]
    medium_risk = [l for l in loops if 50 <= l['risk_score'] < 70]

    print(f"\n  High-risk (≥70): {len(high_risk)}")
    print(f"  Medium-risk (50-69): {len(medium_risk)}")

    if high_risk:
        print("\nTop 5 High-Risk Patterns:")
        for pattern in sorted(high_risk, key=lambda x: x['risk_score'], reverse=True)[:5]:
            print(f"\n  {pattern['account_a']} ←→ {pattern['account_b']}")
            print(f"    {pattern['account_a']} → {pattern['account_b']}: {pattern['forward_transactions']} txs, ₹{pattern['forward_amount']/1_000_000:.1f}M")
            print(f"    {pattern['account_b']} → {pattern['account_a']}: {pattern['backward_transactions']} txs, ₹{pattern['backward_amount']/1_000_000:.1f}M")
            print(f"    Risk Score: {pattern['risk_score']:.0f}%")

    return {
        'mutual_loops': loops,
        'high_risk_count': len(high_risk),
        'medium_risk_count': len(medium_risk)
    }


if __name__ == "__main__":
    results = detect_all_fraud_patterns()
