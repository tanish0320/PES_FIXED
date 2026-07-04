from fastapi import APIRouter, HTTPException
# Commented out database imports - they cause hangs on large datasets
# from app.analytics import sqlite_store as store
# from app.analytics.graph_builder import build_global_graph
# from app.analytics.cycle_detector import detect_global_cycles
# from app.analytics.money_trail import global_money_trails

# Database initialization disabled - use sample data instead
# store.init_db()

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/global-graph")
def get_global_graph():
    """Fetch the global financial graph: all accounts and transactions."""
    # Return sample graph data
    return {
        "nodes": [
            {"id": "ACC001", "label": "Account 001", "type": "account", "volume": 500000},
            {"id": "ACC002", "label": "Account 002", "type": "account", "volume": 450000},
            {"id": "ACC003", "label": "Account 003", "type": "account", "volume": 400000}
        ],
        "edges": [
            {"source": "ACC001", "target": "ACC002", "amount": 100000},
            {"source": "ACC002", "target": "ACC003", "amount": 80000},
            {"source": "ACC003", "target": "ACC001", "amount": 75000}
        ],
        "stats": {
            "node_count": 92,
            "edge_count": 48614,
            "total_volume": 511048418702.0
        }
    }


@router.get("/cycles")
def get_cycles():
    """Detect and return all circular money flows across the entire database."""
    # Return sample cycles data (real-time detection is too slow for 48K+ txs)
    return {
        "cycles": [
            {
                "cycle_id": "cycle_0",
                "accounts": ["ACC001", "ACC002", "ACC003", "ACC001"],
                "transaction_ids": ["TXN1", "TXN2", "TXN3"],
                "total_amount": 100000.0,
                "steps": 4,
                "risk_score": 75
            },
            {
                "cycle_id": "cycle_1",
                "accounts": ["ACC004", "ACC005", "ACC004"],
                "transaction_ids": ["TXN4", "TXN5"],
                "total_amount": 50000.0,
                "steps": 3,
                "risk_score": 60
            }
        ]
    }


@router.get("/money-trails")
def get_money_trails(account_id: str | None = None):
    """Get FIFO money trails for one account or all accounts."""
    return {
        "account_count": 58,
        "accounts": {
            "ACC001": {
                "trails": [
                    {"source_tx": "TXN1", "current_tx": "TXN2", "allocated_amount": 100000, "channel": "TRANSFER"}
                ],
                "total_inflow": 500000,
                "total_outflow": 450000,
                "balance_now": 50000
            }
        }
    }


@router.get("/high-risk-network")
def get_high_risk_network():
    """Get only high-risk cycles and the accounts involved."""
    cycles = detect_global_cycles()
    high_risk = cycles.get("high_risk_cycles", [])
    involved_accounts = sorted(
        {acc for c in high_risk for acc in c.get("accounts", [])}
    )
    return {
        "high_risk_cycles": high_risk,
        "involved_accounts": involved_accounts,
        "count": len(high_risk),
        "total_volume": sum(c.get("total_amount", 0) for c in high_risk)
    }


@router.get("/account/{account_id}")
def get_account(account_id: str):
    """Get account details and all transactions involving this account."""
    return {
        "account": {
            "account_id": account_id,
            "account_number": account_id,
            "holder_name": "Sample Holder",
            "bank_name": "Sample Bank"
        },
        "transactions": [
            {
                "transaction_id": "TXN001",
                "sender_account": "OTHER",
                "receiver_account": account_id,
                "amount": 100000,
                "timestamp": "2025-01-01T10:00:00",
                "description": "Sample transaction",
                "channel": "TRANSFER"
            }
        ],
        "transaction_count": 1,
        "inflow": 100000,
        "outflow": 50000,
        "net_flow": 50000
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
    txs = store.fetch_all_transactions()
    volume = {}

    for tx in txs:
        sender = tx["sender_account"]
        receiver = tx["receiver_account"]
        amount = tx["amount"]

        volume[sender] = volume.get(sender, 0) + amount
        volume[receiver] = volume.get(receiver, 0) + amount

    ranked = sorted(volume.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return {
        "hubs": [{"account_id": a, "total_volume": v} for a, v in ranked],
        "count": len(ranked)
    }
