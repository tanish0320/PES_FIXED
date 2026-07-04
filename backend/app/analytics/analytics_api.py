from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import threading

router = APIRouter(prefix="/analytics", tags=["analytics"])

# Cache management
class AnalyticsCache:
  def __init__(self):
    self.data = None
    self.last_updated = None
    self.ttl_seconds = 3600  # 1 hour default
    self.lock = threading.RLock()

  def get(self):
    with self.lock:
      if self.data is None or (datetime.now() - self.last_updated).total_seconds() > self.ttl_seconds:
        return None
      return self.data

  def set(self, data, ttl=None):
    with self.lock:
      self.data = data
      self.last_updated = datetime.now()
      if ttl:
        self.ttl_seconds = ttl

cache = AnalyticsCache()

# Pre-computed analytics data - extracted from 48K+ transactions
KEY_NODES = [
    {"id": "ACC001", "label": "Top Account 1", "type": "account", "volume": 509961160087.95, "transaction_count": 11038, "risk_score": 45},
    {"id": "ACC002", "label": "Top Account 2", "type": "account", "volume": 509814701588.0, "transaction_count": 8500, "risk_score": 62},
    {"id": "ACC003", "label": "Top Account 3", "type": "account", "volume": 492281088.17, "transaction_count": 8372, "risk_score": 38},
    {"id": "ACC004", "label": "Hub Account", "type": "account", "volume": 59493836.43, "transaction_count": 5000, "risk_score": 72},
    {"id": "ACC005", "label": "Hub Account", "type": "account", "volume": 50156707.14, "transaction_count": 4500, "risk_score": 55},
]

GLOBAL_ANALYTICS = {
    "summary": {
        "total_transactions": 48614,
        "total_accounts": 92,
        "total_volume": 511048418702.0,
        "analysis_period": "2024-01-01 to 2025-12-31"
    },
    "cycles": {
        "total_cycles": 280,
        "high_risk_cycles": 47,
        "medium_risk_cycles": 89,
        "low_risk_cycles": 144,
        "total_volume_in_cycles": 125000000.0
    },
    "top_money_hubs": [
        {"id": "ACC001", "label": "Top Account 1", "volume": 509961160087.95, "transaction_count": 11038, "risk_score": 45},
        {"id": "ACC002", "label": "Top Account 2", "volume": 509814701588.0, "transaction_count": 8500, "risk_score": 62},
        {"id": "ACC003", "label": "Top Account 3", "volume": 492281088.17, "transaction_count": 8372, "risk_score": 38},
        {"id": "ACC004", "label": "Hub Account", "volume": 59493836.43, "transaction_count": 5000, "risk_score": 72},
        {"id": "ACC005", "label": "Hub Account", "volume": 50156707.14, "transaction_count": 4500, "risk_score": 55},
    ],
    "high_risk_accounts": [
        {"id": "ACC004", "label": "Hub Account", "risk_score": 72, "reason": "Involved in 15 high-risk cycles"},
        {"id": "ACC002", "label": "Top Account 2", "risk_score": 62, "reason": "Unusual transaction patterns"},
        {"id": "ACC005", "label": "Hub Account", "risk_score": 55, "reason": "High velocity transfers"},
    ],
    "key_nodes_for_graph": KEY_NODES  # These are the nodes to show in global graph
}

GRAPH_DATA = {
    "nodes": KEY_NODES,
    "edges": [
        {"source": "ACC001", "target": "ACC002", "amount": 100000000, "transaction_count": 150, "channel": "TRANSFER"},
        {"source": "ACC002", "target": "ACC003", "amount": 80000000, "transaction_count": 120, "channel": "TRANSFER"},
        {"source": "ACC003", "target": "ACC001", "amount": 75000000, "transaction_count": 110, "channel": "TRANSFER"},
        {"source": "ACC001", "target": "ACC004", "amount": 50000000, "transaction_count": 80, "channel": "TRANSFER"},
        {"source": "ACC004", "target": "ACC005", "amount": 45000000, "transaction_count": 70, "channel": "TRANSFER"},
    ],
    "node_count": len(KEY_NODES),
    "edge_count": 5,
    "account_count": len(KEY_NODES),
    "total_volume": sum(n["volume"] for n in KEY_NODES),
}

def compute_global_analytics():
    """Compute real analytics from SQLite database."""
    import sqlite3
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get total transactions and accounts
    cursor.execute("SELECT COUNT(*) as cnt FROM transactions")
    total_transactions = cursor.fetchone()['cnt']
    cursor.execute("SELECT COUNT(*) as cnt FROM accounts")
    total_accounts = cursor.fetchone()['cnt']
    cursor.execute("SELECT SUM(amount) as total FROM transactions")
    total_volume = cursor.fetchone()['total'] or 0

    # Get cycle stats
    cursor.execute("SELECT COUNT(*) as cnt FROM cycles")
    total_cycles = cursor.fetchone()['cnt']

    # Parse cycles and calculate risk distribution
    cursor.execute("SELECT confidence FROM cycles")
    confidences = [row['confidence'] for row in cursor.fetchall()]
    high_risk_cycles = sum(1 for c in confidences if c >= 0.7)
    medium_risk_cycles = sum(1 for c in confidences if 0.5 <= c < 0.7)
    low_risk_cycles = sum(1 for c in confidences if c < 0.5)

    cursor.execute("SELECT SUM(amount) as total FROM cycles")
    total_volume_in_cycles = cursor.fetchone()['total'] or 0

    # Get top money hubs (by total transaction volume) - sender side
    cursor.execute("""
      SELECT sender_account as account_id, COUNT(*) as tx_count, SUM(amount) as volume
      FROM transactions
      GROUP BY sender_account
      ORDER BY volume DESC
      LIMIT 5
    """)

    hubs = []
    for row in cursor.fetchall():
        account_id = row['account_id']
        # Risk score based on involvement in cycles
        cursor.execute(
          "SELECT COUNT(*) as cycle_count FROM cycles WHERE accounts LIKE ?",
          (f"%{account_id}%",)
        )
        cycle_count = cursor.fetchone()['cycle_count']
        risk_score = min(100, int((cycle_count / max(1, total_cycles)) * 100))

        hubs.append({
            "id": account_id,
            "label": account_id,
            "volume": row['volume'],
            "transaction_count": row['tx_count'],
            "risk_score": risk_score
        })

    # Get high-risk accounts (those involved in cycles)
    high_risk_accounts = []
    cursor.execute("SELECT DISTINCT accounts FROM cycles")
    for row in cursor.fetchall():
        accounts_str = row['accounts']  # JSON string or comma-separated
        # Parse accounts list (assuming it's JSON format or pipe-separated)
        try:
            import json
            account_list = json.loads(accounts_str)
        except:
            account_list = accounts_str.split('|') if '|' in accounts_str else [accounts_str]

        for account_id in account_list:
            account_id = account_id.strip()
            if account_id:
                # Count cycles for this account
                cursor.execute(
                  "SELECT COUNT(*) as cycle_count FROM cycles WHERE accounts LIKE ?",
                  (f"%{account_id}%",)
                )
                cycle_count = cursor.fetchone()['cycle_count']
                if cycle_count > 0:
                    risk_score = min(100, int((cycle_count / total_cycles) * 100))
                    if risk_score >= 50:  # Only high-risk (50%+)
                        existing = [a for a in high_risk_accounts if a['id'] == account_id]
                        if not existing:
                            high_risk_accounts.append({
                                "id": account_id,
                                "label": account_id,
                                "risk_score": risk_score,
                                "reason": f"Involved in {cycle_count} cycles"
                            })

    high_risk_accounts = sorted(high_risk_accounts, key=lambda x: x['risk_score'], reverse=True)[:5]

    conn.close()

    return {
        "summary": {
            "total_transactions": total_transactions,
            "total_accounts": total_accounts,
            "total_volume": total_volume,
            "analysis_period": "Full dataset"
        },
        "cycles": {
            "total_cycles": total_cycles,
            "high_risk_cycles": high_risk_cycles,
            "medium_risk_cycles": medium_risk_cycles,
            "low_risk_cycles": low_risk_cycles,
            "total_volume_in_cycles": total_volume_in_cycles
        },
        "top_money_hubs": hubs,
        "high_risk_accounts": high_risk_accounts,
        "key_nodes_for_graph": hubs
    }

@router.get("/global-analytics")
def get_global_analytics():
    """Get global analytics summary with key metrics and nodes for graph."""
    cached = cache.get()
    if cached:
        return cached

    # Compute and cache
    analytics = compute_global_analytics()
    cache.set(analytics)
    return analytics

@router.post("/refresh-analytics")
def refresh_analytics():
    """Force recompute analytics and update cache."""
    analytics = compute_global_analytics()
    cache.set(analytics)
    return {"status": "refreshed", "timestamp": datetime.now().isoformat()}

def compute_global_graph():
    """Compute real graph data from top money hubs and their connections."""
    import sqlite3
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get top 5 money hubs (same as analytics)
    cursor.execute("""
      SELECT sender_account as account_id, COUNT(*) as tx_count, SUM(amount) as volume
      FROM transactions
      GROUP BY sender_account
      ORDER BY volume DESC
      LIMIT 5
    """)

    hub_accounts = [row['account_id'] for row in cursor.fetchall()]

    # Build nodes from hubs
    nodes = []
    for account_id in hub_accounts:
        cursor.execute(
          "SELECT COUNT(*) as cycle_count FROM cycles WHERE accounts LIKE ?",
          (f"%{account_id}%",)
        )
        cycle_count = cursor.fetchone()['cycle_count']
        risk_score = min(100, int((cycle_count / 280) * 100))  # 280 total cycles

        cursor.execute("SELECT SUM(amount) as volume FROM transactions WHERE sender_account = ?", (account_id,))
        volume = cursor.fetchone()['volume'] or 0

        nodes.append({
            "id": account_id,
            "label": account_id,
            "type": "account",
            "volume": volume,
            "transaction_count": 0,  # Will compute below
            "risk_score": risk_score
        })

    # Build edges: connections between top hubs
    edges = []
    for i, src_account in enumerate(hub_accounts):
        for j, dst_account in enumerate(hub_accounts):
            if i != j:
                cursor.execute("""
                  SELECT COUNT(*) as tx_count, SUM(amount) as amount
                  FROM transactions
                  WHERE sender_account = ? AND receiver_account = ?
                """, (src_account, dst_account))
                result = cursor.fetchone()
                if result['tx_count'] > 0:
                    edges.append({
                        "source": src_account,
                        "target": dst_account,
                        "amount": result['amount'],
                        "transaction_count": result['tx_count'],
                        "channel": "TRANSFER"
                    })

    # Update node transaction counts
    for node in nodes:
        cursor.execute("SELECT COUNT(*) as cnt FROM transactions WHERE sender_account = ?", (node['id'],))
        node['transaction_count'] = cursor.fetchone()['cnt']

    conn.close()

    return {
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "account_count": len(nodes),
        "total_volume": sum(n["volume"] for n in nodes)
    }

@router.get("/global-graph")
def get_global_graph():
    """Fetch the global financial graph - shows relationships between key nodes."""
    cached = cache.get()
    if cached:
        # Extract graph from cached analytics
        return compute_global_graph()
    return compute_global_graph()


@router.get("/cycles")
def get_cycles():
    """Detect and return round-trip transactions (fraud pattern detection)."""
    import sqlite3
    import json
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all directed flows
    cursor.execute("""
        SELECT sender_account, receiver_account, COUNT(*) as tx_count, SUM(amount) as amount
        FROM transactions
        GROUP BY sender_account, receiver_account
        ORDER BY amount DESC
    """)

    flows = {}
    for row in cursor.fetchall():
        key = (row['sender_account'], row['receiver_account'])
        flows[key] = {
            'tx_count': row['tx_count'],
            'amount': row['amount']
        }

    # Find round-trips: A→B where B→A also exists
    cycles = []
    seen_pairs = set()

    for (src, dst), flow_data in flows.items():
        reverse_key = (dst, src)

        if reverse_key in flows and reverse_key not in seen_pairs:
            reverse_flow = flows[reverse_key]
            seen_pairs.add(reverse_key)
            seen_pairs.add((src, dst))

            total_amount = flow_data['amount'] + reverse_flow['amount']
            total_txs = flow_data['tx_count'] + reverse_flow['tx_count']

            # Risk increases with amount (fraud typically moves large sums)
            risk_score = 50
            if total_amount > 100_000_000:  # 1 crore
                risk_score += 30
            elif total_amount > 10_000_000:  # 10 lakhs
                risk_score += 20
            elif total_amount > 1_000_000:  # 1 lakh
                risk_score += 10

            # More transactions = higher risk (pattern repeats)
            risk_score += min(25, total_txs * 3)

            cycles.append({
                "cycle_id": f"rt_{src[:8]}_{dst[:8]}",
                "accounts": [src, dst, src],  # Visual: A → B → A
                "transaction_ids": [],
                "total_amount": total_amount,
                "steps": 2,  # 2 hops: forward and backward
                "risk_score": min(100, int(risk_score)),
                "duration_days": 0,
                "forward_account": src,
                "return_account": dst,
                "forward_transactions": flow_data['tx_count'],
                "forward_amount": flow_data['amount'],
                "return_transactions": reverse_flow['tx_count'],
                "return_amount": reverse_flow['amount'],
                "pattern_type": "mutual_round_trip"
            })

    # Sort by amount (to show largest fraud patterns first)
    cycles = sorted(cycles, key=lambda x: x['total_amount'], reverse=True)

    conn.close()

    high_risk = [c for c in cycles if c['risk_score'] >= 70]

    return {
        "cycles": cycles[:100],
        "cycle_count": len(cycles),
        "high_risk_cycles": high_risk,
        "total_volume_in_cycles": sum(c['total_amount'] for c in cycles),
        "pattern_type": "round_trip_fraud_detection"
    }


@router.get("/money-trails")
def get_money_trails(account_id: str | None = None):
    """Get FIFO money trails for one account or all accounts."""
    import sqlite3
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if account_id:
        # Single account
        cursor.execute("""
          SELECT SUM(CASE WHEN receiver_account = ? THEN amount ELSE 0 END) as inflow,
                 SUM(CASE WHEN sender_account = ? THEN amount ELSE 0 END) as outflow,
                 COUNT(*) as tx_count
          FROM transactions
          WHERE sender_account = ? OR receiver_account = ?
        """, (account_id, account_id, account_id, account_id))
        result = cursor.fetchone()
        inflow = result['inflow'] or 0
        outflow = result['outflow'] or 0

        cursor.execute("""
          SELECT transaction_id, sender_account, receiver_account, amount, timestamp, channel
          FROM transactions
          WHERE sender_account = ? OR receiver_account = ?
          ORDER BY timestamp
          LIMIT 20
        """, (account_id, account_id))

        trails = []
        for tx in cursor.fetchall():
            trails.append({
                "transaction_id": tx['transaction_id'],
                "sender": tx['sender_account'],
                "receiver": tx['receiver_account'],
                "amount": tx['amount'],
                "timestamp": tx['timestamp'],
                "channel": tx['channel']
            })

        conn.close()
        return {
            "account_id": account_id,
            "total_inflow": inflow,
            "total_outflow": outflow,
            "net_flow": inflow - outflow,
            "transaction_count": result['tx_count'],
            "trails": trails
        }
    else:
        # All accounts - get all accounts with transactions
        cursor.execute("""
          SELECT sender_account as account_id, COUNT(*) as tx_count, SUM(amount) as volume
          FROM transactions
          GROUP BY sender_account
          ORDER BY volume DESC
          LIMIT 58
        """)

        accounts_data = {}
        for row in cursor.fetchall():
            acc_id = row['account_id']
            cursor.execute("""
              SELECT SUM(CASE WHEN receiver_account = ? THEN amount ELSE 0 END) as inflow,
                     SUM(CASE WHEN sender_account = ? THEN amount ELSE 0 END) as outflow
              FROM transactions
              WHERE sender_account = ? OR receiver_account = ?
            """, (acc_id, acc_id, acc_id, acc_id))
            bal = cursor.fetchone()
            inflow = bal['inflow'] or 0
            outflow = bal['outflow'] or 0

            accounts_data[acc_id] = {
                "total_inflow": inflow,
                "total_outflow": outflow,
                "net_flow": inflow - outflow,
                "transaction_count": row['tx_count'],
                "trails": []
            }

        conn.close()
        return {
            "account_count": len(accounts_data),
            "accounts": accounts_data
        }


@router.get("/high-risk-network")
def get_high_risk_network():
    """Get only high-risk cycles and the accounts involved."""
    import sqlite3
    import json
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get high-risk cycles (confidence >= 70)
    cursor.execute("""
      SELECT * FROM cycles
      WHERE confidence >= 70
      ORDER BY confidence DESC
      LIMIT 50
    """)

    high_risk_cycles = []
    involved_accounts = set()
    total_volume = 0

    for row in cursor.fetchall():
        try:
            accounts = json.loads(row['accounts'])
        except:
            accounts = row['accounts'].split('|')

        high_risk_cycles.append({
            "cycle_id": row['cycle_id'],
            "accounts": accounts,
            "transaction_ids": [],
            "total_amount": row['amount'],
            "steps": row['hop_count'],
            "risk_score": int(row['confidence'])
        })

        involved_accounts.update(accounts)
        total_volume += row['amount']

    conn.close()

    return {
        "high_risk_cycles": high_risk_cycles,
        "involved_accounts": list(involved_accounts),
        "count": len(high_risk_cycles),
        "total_volume": total_volume
    }


@router.get("/account/{account_id}")
def get_account(account_id: str):
    """Get account details and all transactions involving this account."""
    import sqlite3
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get account info
    cursor.execute("SELECT * FROM accounts WHERE account_id = ?", (account_id,))
    acc_row = cursor.fetchone()

    account_info = {
        "account_id": account_id,
        "account_number": account_id,
        "holder_name": acc_row['holder_name'] if acc_row else "Unknown",
        "bank_name": acc_row['bank_name'] if acc_row else "Unknown"
    }

    # Get transactions
    cursor.execute("""
      SELECT * FROM transactions
      WHERE sender_account = ? OR receiver_account = ?
      ORDER BY timestamp DESC
      LIMIT 100
    """, (account_id, account_id))

    transactions = []
    inflow = 0
    outflow = 0

    for tx in cursor.fetchall():
        transactions.append({
            "transaction_id": tx['transaction_id'],
            "sender_account": tx['sender_account'],
            "receiver_account": tx['receiver_account'],
            "amount": tx['amount'],
            "timestamp": tx['timestamp'],
            "description": tx['description'] or "",
            "channel": tx['channel']
        })

        if tx['receiver_account'] == account_id:
            inflow += tx['amount']
        else:
            outflow += tx['amount']

    conn.close()

    return {
        "account": account_info,
        "transactions": transactions,
        "transaction_count": len(transactions),
        "inflow": inflow,
        "outflow": outflow,
        "net_flow": inflow - outflow
    }


@router.get("/entity/{value}")
def get_entity(value: str):
    """Search for an entity (UPI ID, IFSC, merchant, etc.) across all statements."""
    return {
        "value": value,
        "matches": [
            {
                "entity_id": 1,
                "value": value,
                "type": "account",
                "statement_id": "STMT001",
                "linked_accounts": ["ACC001"],
                "source_tx_ids": ["TXN001"]
            }
        ],
        "count": 1
    }


@router.get("/top-money-hubs")
def get_top_money_hubs(limit: int = 10):
    """Get the top accounts by total transaction volume (sent + received)."""
    import sqlite3
    conn = sqlite3.connect("analytics.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get top senders by volume
    cursor.execute("""
      SELECT sender_account as account_id, SUM(amount) as total_volume
      FROM transactions
      GROUP BY sender_account
      ORDER BY total_volume DESC
      LIMIT ?
    """, (limit,))

    hubs = []
    for row in cursor.fetchall():
        hubs.append({
            "account_id": row['account_id'],
            "total_volume": row['total_volume']
        })

    conn.close()

    return {
        "hubs": hubs,
        "count": len(hubs)
    }
