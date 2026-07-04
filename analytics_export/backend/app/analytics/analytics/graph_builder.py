from app.analytics import sqlite_store as store


def build_global_graph() -> dict:
    """Build a global financial graph from all transactions and accounts in SQLite.

    Returns a dict with nodes and edges for visualization.
    Nodes: accounts + resolved entities.
    Edges: transactions.
    """
    txs = store.fetch_all_transactions()
    accounts = {a["account_id"]: a for a in store.fetch_all_accounts()}

    # Collect all unique node IDs
    node_ids = set(accounts.keys())
    for tx in txs:
        node_ids.add(tx["sender_account"])
        node_ids.add(tx["receiver_account"])

    # Build nodes
    nodes = []
    for node_id in sorted(node_ids):
        acc = accounts.get(node_id)
        is_known = acc is not None
        is_unknown_external = node_id.startswith("UNKNOWN_EXTERNAL::")

        nodes.append({
            "id": node_id,
            "type": "account" if acc else ("unknown_external" if is_unknown_external else "entity"),
            "label": acc["holder_name"] if acc and acc.get("holder_name") else node_id,
            "bank": acc["bank_name"] if acc else None,
            "is_inferred": not is_known
        })

    # Build edges
    edges = []
    for tx in txs:
        edges.append({
            "id": tx["transaction_id"],
            "source": tx["sender_account"],
            "target": tx["receiver_account"],
            "amount": tx["amount"],
            "timestamp": tx["timestamp"],
            "channel": tx["channel"],
            "description": tx["description"],
            "sender_inferred": bool(tx["sender_is_inferred"]),
            "receiver_inferred": bool(tx["receiver_is_inferred"])
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "account_count": len([n for n in nodes if n["type"] == "account"])
    }
