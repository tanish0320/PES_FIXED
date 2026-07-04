import sys
import os
import time
import json
import traceback
from datetime import datetime, timedelta

# Add parent directory to path to allow imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.engines.financial_metrics.registry import ALL_METRICS
from app.engines.financial_metrics.metrics_engine import FinancialMetricsEngine
from app.engines.financial_metrics.explanations import METRIC_METADATA
from app.engines.statement_parser import StatementParser
from app.engines.normalization_engine import NormalizationEngine
from app.engines.entity_extractor import EntityExtractor
from app.engines.graph_engine import build_money_flow_graph

def generate_edge_case_scenarios():
    base_time = datetime(2026, 1, 1, 12, 0, 0)
    
    scenarios = {}

    # 1. Empty transaction list
    scenarios["empty"] = {
        "txs": [],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    # 2. Single transaction (debit)
    scenarios["single_debit"] = {
        "txs": [{
            "tx_id": "TX-SINGLE-DR",
            "date": base_time,
            "timestamp": base_time.isoformat() + "Z",
            "description": "UPI TRANSFER OUT TO FRIEND",
            "amount": 500.0,
            "is_debit": True,
            "is_internal_transfer": False,
            "balance_after": 1000.0
        }],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {
            "nodes": [
                {"account_id": "ACC-OWNER", "node_type": "account", "risk": 15.0, "status": "active", "tx_count": 1, "total_inflow": 0.0, "total_outflow": 500.0},
                {"account_id": "FRIEND", "node_type": "account", "risk": 0.0, "status": "active", "tx_count": 1, "total_inflow": 500.0, "total_outflow": 0.0}
            ],
            "edges": [
                {"from": "ACC-OWNER", "to": "FRIEND", "amount": 500.0, "tx_id": "TX-SINGLE-DR", "channel": "UPI", "date": base_time.isoformat()}
            ]
        }
    }

    # 3. Single transaction (credit)
    scenarios["single_credit"] = {
        "txs": [{
            "tx_id": "TX-SINGLE-CR",
            "date": base_time,
            "timestamp": base_time.isoformat() + "Z",
            "description": "SALARY RECEIVED",
            "amount": 50000.0,
            "is_debit": False,
            "is_internal_transfer": False,
            "balance_after": 50000.0
        }],
        "entities": {"names": [{"value": "Employer Corp"}], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {
            "nodes": [
                {"account_id": "ACC-OWNER", "node_type": "account", "risk": 15.0, "status": "active", "tx_count": 1, "total_inflow": 50000.0, "total_outflow": 0.0}
            ],
            "edges": []
        }
    }

    # 4. Debit-only statements
    scenarios["debit_only"] = {
        "txs": [
            {"tx_id": f"TX-DR-{i}", "date": base_time + timedelta(hours=i), "timestamp": (base_time + timedelta(hours=i)).isoformat() + "Z", "description": f"ATM WITHDRAWAL {i}", "amount": 5000.0, "is_debit": True, "is_internal_transfer": False, "balance_after": 20000.0 - i * 5000.0}
            for i in range(3)
        ],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    # 5. Credit-only statements
    scenarios["credit_only"] = {
        "txs": [
            {"tx_id": f"TX-CR-{i}", "date": base_time + timedelta(hours=i), "timestamp": (base_time + timedelta(hours=i)).isoformat() + "Z", "description": f"UPI CREDIT {i}", "amount": 10000.0, "is_debit": False, "is_internal_transfer": False, "balance_after": 10000.0 * (i + 1)}
            for i in range(3)
        ],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    # 6. Duplicate timestamps
    scenarios["duplicate_timestamps"] = {
        "txs": [
            {"tx_id": "TX-D1", "date": base_time, "timestamp": base_time.isoformat() + "Z", "description": "TX SAME TIME 1", "amount": 1000.0, "is_debit": True, "is_internal_transfer": False, "balance_after": 9000.0},
            {"tx_id": "TX-D2", "date": base_time, "timestamp": base_time.isoformat() + "Z", "description": "TX SAME TIME 2", "amount": 1000.0, "is_debit": True, "is_internal_transfer": False, "balance_after": 8000.0}
        ],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    # 7. Missing balances
    scenarios["missing_balances"] = {
        "txs": [
            {"tx_id": "TX-MB1", "date": base_time, "timestamp": base_time.isoformat() + "Z", "description": "TX NO BAL 1", "amount": 1500.0, "is_debit": True, "is_internal_transfer": False, "balance_after": None},
            {"tx_id": "TX-MB2", "date": base_time + timedelta(minutes=5), "timestamp": (base_time + timedelta(minutes=5)).isoformat() + "Z", "description": "TX NO BAL 2", "amount": 2500.0, "is_debit": False, "is_internal_transfer": False, "balance_after": None}
        ],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    # 8. Zero amounts
    scenarios["zero_amounts"] = {
        "txs": [
            {"tx_id": "TX-Z1", "date": base_time, "timestamp": base_time.isoformat() + "Z", "description": "ZERO AMT DEBIT", "amount": 0.0, "is_debit": True, "is_internal_transfer": False, "balance_after": 5000.0},
            {"tx_id": "TX-Z2", "date": base_time + timedelta(minutes=5), "timestamp": (base_time + timedelta(minutes=5)).isoformat() + "Z", "description": "ZERO AMT CREDIT", "amount": 0.0, "is_debit": False, "is_internal_transfer": False, "balance_after": 5000.0}
        ],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    # 9. Negative values
    scenarios["negative_values"] = {
        "txs": [
            {"tx_id": "TX-N1", "date": base_time, "timestamp": base_time.isoformat() + "Z", "description": "NEGATIVE DEBIT", "amount": -500.0, "is_debit": True, "is_internal_transfer": False, "balance_after": 4500.0},
            {"tx_id": "TX-N2", "date": base_time + timedelta(minutes=5), "timestamp": (base_time + timedelta(minutes=5)).isoformat() + "Z", "description": "NEGATIVE CREDIT", "amount": -1500.0, "is_debit": False, "is_internal_transfer": False, "balance_after": 3000.0}
        ],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    # 10. Internal transfers
    scenarios["internal_transfers"] = {
        "txs": [
            {"tx_id": "TX-INT1", "date": base_time, "timestamp": base_time.isoformat() + "Z", "description": "FD CREATION Sweep Out", "amount": 100000.0, "is_debit": True, "is_internal_transfer": True, "balance_after": 5000.0},
            {"tx_id": "TX-INT2", "date": base_time + timedelta(minutes=5), "timestamp": (base_time + timedelta(minutes=5)).isoformat() + "Z", "description": "Sweep In FD proceeds", "amount": 100000.0, "is_debit": False, "is_internal_transfer": True, "balance_after": 105000.0}
        ],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    # 11. Duplicate entities
    scenarios["duplicate_entities"] = {
        "txs": [
            {"tx_id": "TX-E1", "date": base_time, "timestamp": base_time.isoformat() + "Z", "description": "UPI TO friend@okaxis", "amount": 1000.0, "is_debit": True, "is_internal_transfer": False, "balance_after": 4000.0}
        ],
        "entities": {
            "names": [{"value": "SNEHA MALHOTRA", "confidence": 1.0}, {"value": "SNEHA MALHOTRA", "confidence": 0.9}],
            "upi_ids": [{"value": "friend@okaxis", "confidence": 1.0}, {"value": "friend@okaxis", "confidence": 1.0}],
            "merchants": [],
            "ifsc_codes": [],
            "patterns": []
        },
        "graph": {"nodes": [], "edges": []}
    }

    # 12. Out-of-order timestamps
    scenarios["out_of_order"] = {
        "txs": [
            {"tx_id": "TX-OO2", "date": base_time + timedelta(hours=2), "timestamp": (base_time + timedelta(hours=2)).isoformat() + "Z", "description": "LATER TRANSACTION", "amount": 1000.0, "is_debit": True, "is_internal_transfer": False, "balance_after": 3000.0},
            {"tx_id": "TX-OO1", "date": base_time, "timestamp": base_time.isoformat() + "Z", "description": "EARLIER TRANSACTION", "amount": 5000.0, "is_debit": False, "is_internal_transfer": False, "balance_after": 8000.0}
        ],
        "entities": {"names": [], "upi_ids": [], "merchants": [], "ifsc_codes": [], "patterns": []},
        "graph": {"nodes": [], "edges": []}
    }

    return scenarios

def validate_all_scenarios(scenarios):
    print("\n==============================================")
    print("RUNNING SCENARIO EDGE CASE VALIDATION")
    print("==============================================")
    
    validation_results = {}
    
    for sc_name, sc_data in scenarios.items():
        print(f"Testing Scenario: {sc_name}")
        validation_results[sc_name] = {}
        txs = sc_data["txs"]
        entities = sc_data["entities"]
        graph = sc_data["graph"]
        
        for metric in ALL_METRICS:
            m_name = metric.name
            try:
                # Compute raw metric
                res = metric.compute(txs, entities, graph)
                
                # Standardize metric to see if formatting works
                standard_res = standardize_metric_local(res, txs)
                
                # Checks:
                warnings = []
                # 1. Evidence check
                evidence = standard_res.get("evidence", [])
                if not evidence or len(evidence) == 0:
                    if standard_res.get("status") != "Not Available":
                        warnings.append("Empty evidence list for active metric")
                
                # 2. Score check
                score = standard_res.get("risk_contribution", 0)
                if not isinstance(score, (int, float)):
                    warnings.append(f"Risk contribution type is {type(score)}, expected numeric")
                
                # 3. Value check
                value = standard_res.get("value")
                if value is None and standard_res.get("status") != "Not Available":
                    warnings.append("Metric value is None")
                
                validation_results[sc_name][m_name] = {
                    "status": "PASS",
                    "warnings": warnings,
                    "contribution": score,
                    "formatted_value": standard_res.get("formatted_value"),
                    "execution_time_ms": 0.0
                }
            except Exception as e:
                print(f"  [CRITICAL FAIL] Metric '{m_name}' crashed in scenario '{sc_name}'!")
                traceback.print_exc()
                validation_results[sc_name][m_name] = {
                    "status": "FAIL",
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "warnings": ["CRASHED"],
                    "contribution": 0,
                    "formatted_value": "ERROR",
                    "execution_time_ms": 0.0
                }
                
    return validation_results

def standardize_metric_local(res, txs):
    from app.engines.financial_metrics.metrics_engine import standardize_metric
    return standardize_metric(res, txs)

def profile_metrics_performance(scenarios):
    print("\n==============================================")
    print("PROFILING METRICS EXECUTION TIME")
    print("==============================================")
    
    profile_results = {}
    sc_data = scenarios["duplicate_timestamps"]
    txs = sc_data["txs"]
    entities = sc_data["entities"]
    graph = sc_data["graph"]
    
    for metric in ALL_METRICS:
        m_name = metric.name
        
        try:
            metric.compute(txs, entities, graph)
        except:
            pass
            
        start = time.perf_counter()
        iterations = 50
        for _ in range(iterations):
            try:
                metric.compute(txs, entities, graph)
            except:
                pass
        end = time.perf_counter()
        avg_time_ms = ((end - start) / iterations) * 1000.0
        
        profile_results[m_name] = avg_time_ms
        print(f"Metric '{m_name}': {avg_time_ms:.4f} ms")
        
    return profile_results

def run_on_seeded_data():
    print("\n==============================================")
    print("RUNNING ON SEEDED DATA FOR CALIBRATION")
    print("==============================================")
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    dataset_dir = os.path.join(base_dir, "Bank-statements-dataset")
    
    files_to_test = [
        ("00869354051.pdf", os.path.join(dataset_dir, "primary", "00869354051.pdf")),
        ("08874795659248.pdf", os.path.join(dataset_dir, "primary", "08874795659248.pdf")),
        ("17771917925.pdf", os.path.join(dataset_dir, "primary", "17771917925.pdf")),
        ("958533930537174-14-02-2024to11-12-2025.pdf", os.path.join(dataset_dir, "Secondary", "958533930537174-14-02-2024to11-12-2025.pdf")),
        ("shivlal statement.txt", os.path.join(dataset_dir, "Secondary", "shivlal statement.txt"))
    ]
    
    parser = StatementParser()
    seeded_results = {}
    
    for filename, filepath in files_to_test:
        if not os.path.exists(filepath):
            print(f"Skipping missing file: {filename}")
            continue
            
        print(f"Processing seeded statement: {filename}...")
        try:
            account_id, raw_txs, parser_stats = parser.parse_statement(filepath)
            txs = NormalizationEngine.normalize(raw_txs, account_id)
            entities = EntityExtractor.extract_all(txs)
            graph = build_money_flow_graph("TEMP", txs, entities, {})
            
            start_time = time.perf_counter()
            metrics_out = FinancialMetricsEngine.compute_metrics(txs, entities, graph)
            elapsed = (time.perf_counter() - start_time) * 1000.0
            
            all_m = metrics_out["all_metrics"]
            total_risk_contribution = sum(m.get("risk_contribution", 0) for m in all_m)
            
            triggered_contributions = {}
            for m in all_m:
                contrib = m.get("risk_contribution", 0)
                if contrib > 0:
                    triggered_contributions[m["name"]] = contrib
            
            seeded_results[filename] = {
                "transaction_count": len(txs),
                "total_inflow": sum(t["amount"] for t in txs if not t["is_debit"]),
                "total_outflow": sum(t["amount"] for t in txs if t["is_debit"]),
                "total_risk_contribution": total_risk_contribution,
                "elapsed_time_ms": elapsed,
                "triggered_metrics": triggered_contributions
            }
            
            print(f"  Processed {len(txs)} txs in {elapsed:.1f}ms. Total Risk Contribution: {total_risk_contribution}")
            print(f"  Triggered: {triggered_contributions}")
            
        except Exception as e:
            print(f"  Error processing {filename}: {str(e)}")
            traceback.print_exc()
            
    return seeded_results

def generate_developer_validation_report(validation_results, profile_results, seeded_results):
    print("\n==============================================")
    print("GENERATING DEVELOPER VALIDATION REPORT")
    print("==============================================")
    
    report = {
        "report_generated_at": datetime.now().isoformat(),
        "metrics_summary": []
    }
    
    for metric in ALL_METRICS:
        m_name = metric.name
        metric_id = FinancialMetricsEngine.to_snake_case(m_name)
        meta = METRIC_METADATA.get(metric_id, {})
        weight = meta.get("weight", 5)
        
        exec_time = profile_results.get(m_name, 0.0)
        
        status = "PASS"
        failures = []
        warnings = []
        evidence_counts = []
        
        for sc_name, sc_metrics in validation_results.items():
            if m_name in sc_metrics:
                sc_res = sc_metrics[m_name]
                if sc_res["status"] == "FAIL":
                    status = "FAIL"
                    failures.append(f"Crashed in scenario '{sc_name}': {sc_res.get('error')}")
                if sc_res.get("warnings"):
                    warnings.extend([f"Scenario '{sc_name}': {w}" for w in sc_res["warnings"]])
                
                mock_txs = generate_edge_case_scenarios()[sc_name]["txs"]
                try:
                    res_raw = metric.compute(mock_txs, generate_edge_case_scenarios()[sc_name]["entities"], generate_edge_case_scenarios()[sc_name]["graph"])
                    res_std = standardize_metric_local(res_raw, mock_txs)
                    evidence_list = res_std.get("evidence", [])
                    evidence_counts.append(len(evidence_list))
                except:
                    evidence_counts.append(0)
        
        avg_evidence_count = sum(evidence_counts) / len(evidence_counts) if evidence_counts else 0
        
        max_contrib = 0
        for sc_name, sc_metrics in validation_results.items():
            if m_name in sc_metrics:
                max_contrib = max(max_contrib, sc_metrics[m_name].get("contribution", 0))
        for f_name, f_data in seeded_results.items():
            max_contrib = max(max_contrib, f_data["triggered_metrics"].get(m_name, 0))
            
        report["metrics_summary"].append({
            "metric_name": m_name,
            "metric_id": metric_id,
            "category": metric.category,
            "execution_time_ms": round(exec_time, 4),
            "evidence_count_average": round(avg_evidence_count, 1),
            "risk_weight": weight,
            "max_observed_contribution": max_contrib,
            "validation_status": status,
            "failures": failures,
            "warnings": list(set(warnings))
        })
        
    report["seeded_data_comparison"] = seeded_results
    
    tests_dir = os.path.dirname(os.path.abspath(__file__))
    report_file_path = os.path.join(tests_dir, "debug_validation_report.json")
    with open(report_file_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        
    print(f"Developer report written to: {report_file_path}")
    
    md_file_path = os.path.join(tests_dir, "debug_validation_report.md")
    with open(md_file_path, "w", encoding="utf-8") as f:
        f.write("# Metrics Engine Developer Validation Report\n\n")
        f.write(f"Generated at: `{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`\n\n")
        
        f.write("## Metric Summary Table\n\n")
        f.write("| Metric Name | Category | Exec Time (ms) | Avg Evidences | Risk Weight | Max Contribution | Status | Warnings |\n")
        f.write("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |\n")
        for m in report["metrics_summary"]:
            warn_str = ", ".join(m["warnings"]) if m["warnings"] else "None"
            f.write(f"| {m['metric_name']} | {m['category']} | {m['execution_time_ms']:.4f} | {m['evidence_count_average']} | {m['risk_weight']} | {m['max_observed_contribution']} | {m['validation_status']} | {warn_str} |\n")
            
        f.write("\n## Seeded Data Calibration\n\n")
        for filename, data in seeded_results.items():
            f.write(f"### `{filename}`\n")
            f.write(f"- **Transactions**: {data['transaction_count']}\n")
            f.write(f"- **Inflow**: ₹{data['total_inflow']:,.2f}\n")
            f.write(f"- **Outflow**: ₹{data['total_outflow']:,.2f}\n")
            f.write(f"- **Risk Score Total Contribution**: {data['total_risk_contribution']}\n")
            f.write(f"- **Triggered Metrics**:\n")
            for m_name, contrib in data["triggered_metrics"].items():
                f.write(f"  - `{m_name}`: +{contrib}\n")
            f.write("\n")
            
    print(f"Markdown developer report written to: {md_file_path}")

if __name__ == "__main__":
    print("Starting financial metrics validation suite...")
    scenarios = generate_edge_case_scenarios()
    validation_results = validate_all_scenarios(scenarios)
    profile_results = profile_metrics_performance(scenarios)
    seeded_results = run_on_seeded_data()
    generate_developer_validation_report(validation_results, profile_results, seeded_results)
