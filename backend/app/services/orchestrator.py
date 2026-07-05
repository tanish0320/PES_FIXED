import uuid
from typing import Dict, Any, List
from app.engines.statement_parser import StatementParser
from app.engines.normalization_engine import NormalizationEngine
from app.engines.entity_extractor import EntityExtractor
from app.engines.pattern_detection_engine import PatternDetectionEngine
from app.engines.scoring_engine import score_investigation
from app.engines.graph_engine import build_money_flow_graph
from app.engines.timeline_generator import TimelineGenerator
from app.services.report_generator import ReportGenerator
from app.engines.case_manager import CaseManager

def update_search_index(case_id: str, entities: dict, account_id: str, store: dict):
    """
    Index names, UPI IDs, IFSC codes, merchants, and accounts for global search.
    """
    store.setdefault("search_index", {})
    index = store["search_index"]
    
    def add_to_index(term: str, type_str: str, context: str):
        if not term:
            return
        t_low = str(term).strip().lower()
        if not t_low:
            return
        entry = {
            "case_id": case_id,
            "type": type_str,
            "context": context,
            "value": str(term)
        }
        if t_low not in index:
            index[t_low] = []
        if entry not in index[t_low]:
            index[t_low].append(entry)

    # Index primary account holder and account details
    add_to_index(account_id, "account", "Primary Statement Account")
    
    # Index extracted entities
    for name_ent in entities.get("names", []):
        add_to_index(name_ent["value"], "name", "Extracted Name")
        
    for upi_ent in entities.get("upi_ids", []):
        add_to_index(upi_ent["value"], "upi", "UPI Identifier")
        
    for ifsc_ent in entities.get("ifsc_codes", []):
        add_to_index(ifsc_ent["value"], "ifsc", "IFSC Code")
        
    for merchant_ent in entities.get("merchants", []):
        add_to_index(merchant_ent["value"], "merchant", "Merchant Entity")

def process_statement(file_path: str, original_filename: str, store: dict) -> Dict[str, Any]:
    """
    Process an uploaded statement through the complete workstation pipeline.
    """
    import time
    start_time = time.time()

    print(f"[ORCHESTRATOR] 1. Starting statement parsing for {original_filename}", flush=True)
    t = time.time()
    parser = StatementParser()
    account_id, raw_txs, parser_stats = parser.parse_statement(file_path)
    print(f"[ORCHESTRATOR] 2. Parsed: {len(raw_txs)} txs ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 3. Normalizing...", flush=True)
    t = time.time()
    txs = NormalizationEngine.normalize(raw_txs, account_id)
    print(f"[ORCHESTRATOR] 4. Normalized ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 5. Extracting entities...", flush=True)
    t = time.time()
    entities = EntityExtractor.extract_all(txs)
    print(f"[ORCHESTRATOR] 6. Entities extracted ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 7. Detecting patterns...", flush=True)
    t = time.time()
    patterns_data = PatternDetectionEngine.detect(txs, account_id)
    patterns = patterns_data.get("patterns", [])
    print(f"[ORCHESTRATOR] 8. Patterns detected: {len(patterns)} ({time.time()-t:.2f}s)", flush=True)

    case_id = f"INV-{uuid.uuid4().hex[:6].upper()}"
    print(f"[ORCHESTRATOR] 9. Case ID: {case_id}. Building graph...", flush=True)
    t = time.time()
    graph = build_money_flow_graph(case_id, txs, entities, store)
    print(f"[ORCHESTRATOR] 10. Graph built ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 11. Computing metrics...", flush=True)
    t = time.time()
    from app.engines.financial_metrics.metrics_engine import FinancialMetricsEngine
    entities_copy = dict(entities)
    entities_copy["patterns"] = patterns
    metrics = FinancialMetricsEngine.compute_metrics(txs, entities_copy, graph)
    print(f"[ORCHESTRATOR] 12. Metrics computed ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 13. Rebuilding graph with metrics...", flush=True)
    t = time.time()
    graph = build_money_flow_graph(case_id, txs, entities, store, metrics)
    print(f"[ORCHESTRATOR] 14. Graph rebuilt ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 15. Scoring...", flush=True)
    t = time.time()
    risk_data = score_investigation(txs, patterns, account_id, entities_copy, graph, metrics)
    print(f"[ORCHESTRATOR] 16. Scored: {risk_data.get('risk_score')} ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 17. Creating case...", flush=True)
    t = time.time()
    case = CaseManager.create_investigation(
        case_id=case_id,
        account_id=account_id,
        risk_data=risk_data,
        transactions=txs,
        patterns=patterns,
        entities=entities,
        parser_stats=parser_stats,
        source_file=original_filename,
        store=store
      )
    print(f"[ORCHESTRATOR] 18. Case created ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 19. Generating timeline...", flush=True)
    t = time.time()
    timeline = TimelineGenerator.generate(txs, patterns, entities, graph, risk_data.get("risk_score", 0.0))
    print(f"[ORCHESTRATOR] 20. Timeline: {len(timeline['case_timeline'])} events ({time.time()-t:.2f}s)", flush=True)

    print(f"[ORCHESTRATOR] 21. Generating report...", flush=True)
    t = time.time()
    report = ReportGenerator.generate_report(
        case=case,
        transactions=txs,
        patterns_data=patterns_data,
        entities=entities,
        graph=graph,
        timeline=timeline,
        parser_stats=parser_stats,
        metrics=metrics
    )
    print(f"[ORCHESTRATOR] 22. Report generated ({time.time()-t:.2f}s)", flush=True)
    
    # Store report and populate data store
    print(f"[ORCHESTRATOR] 23. Saving report to data store", flush=True)
    store.setdefault("reports", {})
    store["reports"][case_id] = report
    
    store.setdefault("transactions", {})
    for tx in txs:
        # Link transaction details for display
        tx["case_id"] = case_id
        tx["risk_score"] = risk_data["risk_score"]
        store["transactions"][tx["tx_id"]] = tx
    print(f"[ORCHESTRATOR] 24. Transactions mapped to case in store", flush=True)
        
    # 11. Update search index
    print(f"[ORCHESTRATOR] 25. Updating search index", flush=True)
    t = time.time()
    update_search_index(case_id, entities, account_id, store)
    print(f"[ORCHESTRATOR] 26. Search indexed ({time.time()-t:.2f}s)", flush=True)

    total_time = time.time() - start_time
    print(f"[ORCHESTRATOR] TOTAL PROCESSING TIME: {total_time:.2f}s ({total_time/60:.1f}m)", flush=True)

    return {
        "case_id": case_id,
        "case": case,
        "summary": report.get("executive_summary"),
        "parser_stats": parser_stats,
        "processing_time_seconds": total_time
    }
