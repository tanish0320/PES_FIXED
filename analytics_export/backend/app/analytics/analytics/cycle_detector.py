from datetime import datetime
from app.engines.cycle_detection_engine import CycleDetectionEngine
from app.analytics import sqlite_store as store


def detect_global_cycles() -> dict:
    """Detect cycles across the entire global financial graph in SQLite.

    Uses the existing CycleDetectionEngine's DFS algorithm on the global edge set.
    Persists detected cycles into the cycles table.
    """
    txs = store.fetch_all_transactions()

    # Build raw_edges format expected by CycleDetectionEngine.detect_cycles
    raw_edges = []
    for tx in txs:
        # Parse timestamp if it's a string
        ts = tx["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)

        raw_edges.append({
            "from_raw": tx["sender_account"],
            "to_raw": tx["receiver_account"],
            "edge_id": tx["transaction_id"],
            "amount": tx["amount"],
            "timestamp": ts
        })

    # Run the existing cycle detector on the global edge set
    result = CycleDetectionEngine.detect_cycles(raw_edges=raw_edges)

    # Persist detected cycles into the cycles table (overwrite previous detection)
    now = datetime.utcnow().isoformat()
    for c in result.get("cycles", []):
        store.upsert_cycle(
            cycle_id=c["cycle_id"],
            accounts=c["accounts"],
            transaction_ids=c["transaction_ids"],
            amount=c["total_amount"],
            hop_count=c["steps"],
            confidence=c["risk_score"],
            detected_at=now
        )

    return result
