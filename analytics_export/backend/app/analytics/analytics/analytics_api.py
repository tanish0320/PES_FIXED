from fastapi import APIRouter, HTTPException
from app.analytics import sqlite_store as store
from app.analytics.graph_builder import build_global_graph
from app.analytics.cycle_detector import detect_global_cycles
from app.analytics.money_trail import global_money_trails

# Initialize database at import time
store.init_db()

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/global-graph")
def get_global_graph():
    """Fetch the global financial graph: all accounts and transactions."""
    return build_global_graph()


@router.get("/cycles")
def get_cycles():
    """Detect and return all circular money flows across the entire database."""
    return detect_global_cycles()


@router.get("/money-trails")
def get_money_trails(account_id: str | None = None):
    """Get FIFO money trails for one account or all accounts."""
    return global_money_trails(account_id)


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
    acc = store.fetch_account_by_id(account_id)
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    txs = store.fetch_transactions_for_account(account_id)
    inflow = sum(tx["amount"] for tx in txs if tx["receiver_account"] == account_id)
    outflow = sum(tx["amount"] for tx in txs if tx["sender_account"] == account_id)

    return {
        "account": dict(acc),
        "transactions": [dict(tx) for tx in txs],
        "transaction_count": len(txs),
        "inflow": inflow,
        "outflow": outflow,
        "net_flow": inflow - outflow
    }


@router.get("/entity/{value}")
def get_entity(value: str):
    """Search for an entity (UPI ID, IFSC, merchant, etc.) across all statements."""
    matches = store.fetch_entities_by_value(value)
    if not matches:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {
        "value": value,
        "matches": [dict(m) for m in matches],
        "count": len(matches)
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
