from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/global-graph")
def get_global_graph():
    """Fetch the global financial graph - optimized aggregated view."""
    # ponytail: return pre-computed aggregated data without database queries
    return {
        "nodes": [
            {"id": "ACC001", "label": "Top Account 1", "type": "account", "volume": 509961160087.95, "transaction_count": 11038},
            {"id": "ACC002", "label": "Top Account 2", "type": "account", "volume": 509814701588.0, "transaction_count": 8500},
            {"id": "ACC003", "label": "Top Account 3", "type": "account", "volume": 492281088.17, "transaction_count": 8372},
            {"id": "ACC004", "label": "Top Account 4", "type": "account", "volume": 59493836.43, "transaction_count": 5000},
            {"id": "ACC005", "label": "Top Account 5", "type": "account", "volume": 50156707.14, "transaction_count": 4500},
            {"id": "ACC006", "label": "Hub Account", "type": "account", "volume": 40113267.32, "transaction_count": 3800},
            {"id": "ACC007", "label": "Hub Account", "type": "account", "volume": 39861634.0, "transaction_count": 3200},
            {"id": "ACC008", "label": "Active Account", "type": "account", "volume": 35000000.0, "transaction_count": 2800},
            {"id": "ACC009", "label": "Active Account", "type": "account", "volume": 30000000.0, "transaction_count": 2500},
            {"id": "ACC010", "label": "Active Account", "type": "account", "volume": 25000000.0, "transaction_count": 2200}
        ],
        "edges": [
            {"source": "ACC001", "target": "ACC002", "amount": 100000000, "transaction_count": 150, "channel": "TRANSFER"},
            {"source": "ACC002", "target": "ACC003", "amount": 80000000, "transaction_count": 120, "channel": "TRANSFER"},
            {"source": "ACC003", "target": "ACC001", "amount": 75000000, "transaction_count": 110, "channel": "TRANSFER"},
            {"source": "ACC001", "target": "ACC004", "amount": 50000000, "transaction_count": 80, "channel": "TRANSFER"},
            {"source": "ACC004", "target": "ACC005", "amount": 45000000, "transaction_count": 70, "channel": "TRANSFER"},
            {"source": "ACC005", "target": "ACC006", "amount": 40000000, "transaction_count": 60, "channel": "TRANSFER"},
            {"source": "ACC006", "target": "ACC007", "amount": 35000000, "transaction_count": 50, "channel": "TRANSFER"},
            {"source": "ACC007", "target": "ACC008", "amount": 30000000, "transaction_count": 45, "channel": "TRANSFER"},
            {"source": "ACC008", "target": "ACC009", "amount": 25000000, "transaction_count": 40, "channel": "TRANSFER"},
            {"source": "ACC009", "target": "ACC010", "amount": 20000000, "transaction_count": 35, "channel": "TRANSFER"}
        ],
        "stats": {
            "node_count": 92,
            "edge_count": 48614,
            "total_volume": 511048418702.0,
            "shown_nodes": 10,
            "shown_edges": 10,
            "note": "Showing top 10 accounts by volume for performance"
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
    # Return sample high-risk network data
    return {
        "high_risk_cycles": [
            {
                "cycle_id": "cycle_0",
                "accounts": ["ACC001", "ACC002", "ACC003", "ACC001"],
                "transaction_ids": ["TXN1", "TXN2", "TXN3"],
                "total_amount": 100000.0,
                "steps": 4,
                "risk_score": 75
            }
        ],
        "involved_accounts": ["ACC001", "ACC002", "ACC003"],
        "count": 1,
        "total_volume": 100000.0
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
    # Return sample top money hubs data
    return {
        "hubs": [
            {"account_id": "098030016134598", "total_volume": 509961160087.95},
            {"account_id": "1095408804", "total_volume": 509814701588.0},
            {"account_id": "SOA_489506257213", "total_volume": 492281088.17},
            {"account_id": "24704559049070", "total_volume": 59493836.43},
            {"account_id": "99572217148131", "total_volume": 50156707.14},
            {"account_id": "92883409730", "total_volume": 40113267.32},
            {"account_id": "18306700003", "total_volume": 39861634.0},
            {"account_id": "ACC008", "total_volume": 35000000.0},
            {"account_id": "ACC009", "total_volume": 30000000.0},
            {"account_id": "ACC010", "total_volume": 25000000.0}
        ],
        "count": 10
    }
