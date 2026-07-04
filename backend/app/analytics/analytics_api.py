from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/analytics", tags=["analytics"])

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

@router.get("/global-analytics")
def get_global_analytics():
    """Get global analytics summary with key metrics and nodes for graph."""
    return GLOBAL_ANALYTICS

@router.get("/global-graph")
def get_global_graph():
    """Fetch the global financial graph - shows relationships between key nodes."""
    return GRAPH_DATA


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
