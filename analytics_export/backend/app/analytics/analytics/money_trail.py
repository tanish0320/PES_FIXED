from datetime import datetime
from app.engines.money_trail_engine import MoneyTrailEngine
from app.analytics import sqlite_store as store


def _to_engine_tx(tx: dict, account_id: str) -> dict:
    """Reshape a transaction dict from SQLite into the format MoneyTrailEngine expects.

    MoneyTrailEngine expects: tx_id, amount, is_debit, timestamp, description, balance_after.
    SQLite tx has: transaction_id, sender_account, receiver_account, amount, timestamp, description, channel.
    """
    # is_debit = True if this account is the sender (money flowing out)
    is_debit = tx["sender_account"] == account_id

    # Parse timestamp if it's a string
    ts = tx["timestamp"]
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)

    return {
        "tx_id": tx["transaction_id"],
        "amount": tx["amount"],
        "is_debit": is_debit,
        "timestamp": ts,
        "description": tx.get("description", ""),
        "balance_after": None,  # Not available in our schema, but MoneyTrailEngine tolerates None
        "channel": tx.get("channel")
    }


def global_money_trails(account_id: str | None = None) -> dict:
    """Compute money trails for the given account (or all accounts if None).

    Uses the existing MoneyTrailEngine.allocate_trails for FIFO allocation.
    Returns dict keyed by account_id with trail results.
    """
    if account_id:
        accounts = [account_id]
    else:
        accounts = [a["account_id"] for a in store.fetch_all_accounts()]

    all_trails = {}
    for acc in accounts:
        txs = store.fetch_transactions_for_account(acc)
        if not txs:
            continue

        # Reshape into engine format and sort by timestamp
        shaped = [_to_engine_tx(tx, acc) for tx in txs]
        shaped.sort(key=lambda x: x["timestamp"] if x["timestamp"] else datetime.min)

        # Allocate using the existing engine
        trails = MoneyTrailEngine.allocate_trails(shaped, acc)
        if trails:
            all_trails[acc] = trails

    return {
        "account_count": len(all_trails),
        "accounts": all_trails
    }
