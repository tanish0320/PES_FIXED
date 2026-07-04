import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path to allow imports when running directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.engines.financial_metrics.metrics_engine import FinancialMetricsEngine
from app.engines.financial_metrics.registry import ALL_METRICS

def create_sample_dataset():
    # Account owner: ACC-OWNER
    account_id = "ACC-OWNER"
    base_time = datetime(2026, 1, 1, 10, 0, 0)
    
    transactions = [
        # Normal credits
        {
            "tx_id": "TX-01",
            "date": base_time,
            "timestamp": base_time.isoformat() + "Z",
            "description": "CREDIT FROM DAD",
            "amount": 10000.0,
            "is_debit": False,
            "balance_after": 10000.0,
            "is_internal_transfer": False
        },
        # Round debit immediately after (10 mins)
        {
            "tx_id": "TX-02",
            "date": base_time + timedelta(minutes=10),
            "timestamp": (base_time + timedelta(minutes=10)).isoformat() + "Z",
            "description": "TRANSFER TO FRIEND1@okaxis",
            "amount": 5000.0,
            "is_debit": True,
            "balance_after": 5000.0,
            "is_internal_transfer": False
        },
        # Repeated amount credit (20 mins after)
        {
            "tx_id": "TX-03",
            "date": base_time + timedelta(minutes=20),
            "timestamp": (base_time + timedelta(minutes=20)).isoformat() + "Z",
            "description": "UPI RECEIVED FROM SELF",
            "amount": 5000.0,
            "is_debit": False,
            "balance_after": 10000.0,
            "is_internal_transfer": False
        },
        # Failed transaction
        {
            "tx_id": "TX-04",
            "date": base_time + timedelta(minutes=30),
            "timestamp": (base_time + timedelta(minutes=30)).isoformat() + "Z",
            "description": "DECLINED PAYMENT AT SHOP",
            "amount": 2500.0,
            "is_debit": True,
            "balance_after": 10000.0,
            "status": "FAILED",
            "is_internal_transfer": False
        },
        # Large Credit to trigger structuring and compression (20L)
        {
            "tx_id": "TX-05",
            "date": base_time + timedelta(hours=2),
            "timestamp": (base_time + timedelta(hours=2)).isoformat() + "Z",
            "description": "LOAN DISBURSEMENT NEFT-BANK-XYZ",
            "amount": 200000.0,
            "is_debit": False,
            "balance_after": 210000.0,
            "is_internal_transfer": False
        },
        # 3 Structured/compressed debits shortly after (below 50k limit)
        {
            "tx_id": "TX-06",
            "date": base_time + timedelta(hours=3),
            "timestamp": (base_time + timedelta(hours=3)).isoformat() + "Z",
            "description": "WITHDRAWAL AT ATM-01",
            "amount": 49000.0,
            "is_debit": True,
            "balance_after": 161000.0,
            "is_internal_transfer": False
        },
        {
            "tx_id": "TX-07",
            "date": base_time + timedelta(hours=4),
            "timestamp": (base_time + timedelta(hours=4)).isoformat() + "Z",
            "description": "WITHDRAWAL AT ATM-02",
            "amount": 49000.0,
            "is_debit": True,
            "balance_after": 112000.0,
            "is_internal_transfer": False
        },
        {
            "tx_id": "TX-08",
            "date": base_time + timedelta(hours=5),
            "timestamp": (base_time + timedelta(hours=5)).isoformat() + "Z",
            "description": "WITHDRAWAL AT ATM-03",
            "amount": 49000.0,
            "is_debit": True,
            "balance_after": 63000.0,
            "is_internal_transfer": False
        },
        # Internal sweep to exclude from metrics
        {
            "tx_id": "TX-09",
            "date": base_time + timedelta(hours=6),
            "timestamp": (base_time + timedelta(hours=6)).isoformat() + "Z",
            "description": "TRANSFER/DEBIT FOR FD A/C",
            "amount": 50000.0,
            "is_debit": True,
            "balance_after": 13000.0,
            "is_internal_transfer": True
        },
        # Activation after dormancy (dormancy check: 40 days gap)
        {
            "tx_id": "TX-10",
            "date": base_time + timedelta(days=41),
            "timestamp": (base_time + timedelta(days=41)).isoformat() + "Z",
            "description": "UPI FROM BOSS@okicici",
            "amount": 60000.0,
            "is_debit": False,
            "balance_after": 73000.0,
            "is_internal_transfer": False
        }
    ]

    entities = {
        "names": [{"value": "John Doe", "confidence": 1.0}],
        "upi_ids": [{"value": "friend1@okaxis", "confidence": 1.0}, {"value": "boss@okicici", "confidence": 1.0}],
        "merchants": [],
        "ifsc_codes": [],
        "patterns": [
            {"name": "Cash Intensive Behaviour", "description": "High ATM withdrawals", "related_transactions": ["TX-06", "TX-07", "TX-08"]}
        ],
        "parser_statistics": {
            "confidence": 100.0,
            "total_rows": 10,
            "parsed_rows": 10,
            "warnings": []
        }
    }

    # Define simple graph
    graph = {
        "nodes": [
            {"account_id": "ACC-OWNER", "label": "John Doe (Owner)", "node_type": "account", "risk": 40.0},
            {"account_id": "friend1@okaxis", "label": "friend1@okaxis", "node_type": "upi_id", "risk": 40.0},
            {"account_id": "ATM-01", "label": "ATM-01", "node_type": "merchant", "risk": 20.0},
            {"account_id": "ATM-02", "label": "ATM-02", "node_type": "merchant", "risk": 20.0},
            {"account_id": "ATM-03", "label": "ATM-03", "node_type": "merchant", "risk": 20.0},
            {"account_id": "boss@okicici", "label": "boss@okicici", "node_type": "upi_id", "risk": 40.0}
        ],
        "edges": [
            {"from": "ACC-OWNER", "to": "friend1@okaxis", "amount": 5000.0, "tx_id": "TX-02", "description": "TRANSFER TO FRIEND1@okaxis"},
            {"from": "ACC-OWNER", "to": "ATM-01", "amount": 49000.0, "tx_id": "TX-06", "description": "WITHDRAWAL AT ATM-01"},
            {"from": "ACC-OWNER", "to": "ATM-02", "amount": 49000.0, "tx_id": "TX-07", "description": "WITHDRAWAL AT ATM-02"},
            {"from": "ACC-OWNER", "to": "ATM-03", "amount": 49000.0, "tx_id": "TX-08", "description": "WITHDRAWAL AT ATM-03"},
            {"from": "boss@okicici", "to": "ACC-OWNER", "amount": 60000.0, "tx_id": "TX-10", "description": "UPI FROM BOSS@okicici"}
        ]
    }

    return transactions, entities, graph

def run_tests():
    print("Preparing sample dataset...")
    transactions, entities, graph = create_sample_dataset()
    
    print("Computing metrics...")
    metrics = FinancialMetricsEngine.compute_metrics(transactions, entities, graph)
    
    # Assertions
    print("Validating Transaction Behaviour Metrics...")
    tx_b = metrics["transaction_metrics"]
    assert "rapid_money_movement" in tx_b
    assert "transaction_velocity" in tx_b
    assert "burst_activity" in tx_b
    assert "dormant_activation" in tx_b
    assert "immediate_balance_drain" in tx_b
    
    # Confirm dormancy activation matched (40 days dormancy gap)
    dormancy_val = tx_b["dormant_activation"]["value"]
    assert dormancy_val["dormancy_days"] >= 30, f"Expected >= 30 days dormancy, got {dormancy_val['dormancy_days']}"
    print("  [PASS] Dormancy validation")

    # Confirm immediate balance drain is computed correctly
    drain_val = tx_b["immediate_balance_drain"]["value"]
    assert drain_val > 0.0, f"Expected drain value > 0, got {drain_val}"
    print("  [PASS] Immediate balance drain validation")

    print("Validating Amount Metrics...")
    amt_m = metrics["amount_metrics"]
    assert "repeated_amount_detector" in amt_m
    assert "round_amount_percent" in amt_m
    assert "first_transaction_equals_last_transaction" in amt_m
    assert "fifo_score" in amt_m
    assert "lifo_score" in amt_m
    assert "split_amount_ratio" in amt_m
    assert "merge_ratio" in amt_m
    assert "large_to_small_compression" in amt_m

    # Repeated amount detector
    repeats = amt_m["repeated_amount_detector"]["value"]
    assert 5000.0 in repeats["top_repeated"], "Expected 5000.0 to be flagged as repeated"
    print("  [PASS] Repeated amount validation")

    # Large to small compression
    compression = amt_m["large_to_small_compression"]["value"]
    assert compression > 0.0, f"Expected compression ratio > 0, got {compression}"
    print("  [PASS] Large to small compression validation")

    print("Validating Account Metrics...")
    acc_m = metrics["account_metrics"]
    assert "unique_beneficiaries" in acc_m
    assert "unique_senders" in acc_m
    assert "credit_volume" in acc_m
    assert "debit_volume" in acc_m
    assert "average_holding_time" in acc_m
    assert "balance_retention_percent" in acc_m
    
    # Verify holding time
    holding_time = acc_m["average_holding_time"]["value"]
    assert holding_time != "N/A", "Expected holding time to be valid"
    print(f"  [PASS] Average holding time: {holding_time}")

    # Verify balance retention
    retention = acc_m["balance_retention_percent"]["value"]
    assert retention > 0.0, f"Expected retention > 0, got {retention}"
    print("  [PASS] Balance retention validation")

    print("Validating Graph Metrics...")
    graph_m = metrics["graph_metrics"]
    assert "maximum_layer_depth" in graph_m
    assert "longest_money_path" in graph_m
    assert "highest_betweenness" in graph_m
    assert "graph_density" in graph_m
    
    # Max degree checking
    max_deg = graph_m["highest_degree"]["value"]
    assert max_deg > 0, "Expected max degree > 0"
    print("  [PASS] Graph topology validation")

    print("Validating Investigation Metrics...")
    inv_m = metrics["investigation_metrics"]
    assert "pattern_density" in inv_m
    assert "investigation_confidence" in inv_m
    assert "failed_transactions" in inv_m
    
    # Failed transaction checking
    failed_val = inv_m["failed_transactions"]["value"]
    assert failed_val != "Not Available", "Expected failed transaction metrics"
    assert failed_val["failed_count"] == 1, f"Expected 1 failed transaction, got {failed_val['failed_count']}"
    print("  [PASS] Failed transaction validation")

    print("Validating Performance...")
    perf = metrics["performance_metadata"]
    print(f"  Processed {perf['transactions_processed']} transactions in {perf['elapsed_time_ms']:.2f} ms")
    assert perf["elapsed_time_ms"] < 200.0, "Expected performance to be under 200ms"
    print("  [PASS] Performance SLA validation")

    print("\nALL METRICS WORKSTATION TESTS PASSED SUCCESSFULLY.")

if __name__ == "__main__":
    run_tests()
