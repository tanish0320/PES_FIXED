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
    print(f"[ORCHESTRATOR] 1. Starting statement parsing for {original_filename}", flush=True)
    # 1. Parse statement
    parser = StatementParser()
    account_id, raw_txs, parser_stats = parser.parse_statement(file_path)
    print(f"[ORCHESTRATOR] 2. Statement parsed successfully. Account ID: {account_id}, Txs: {len(raw_txs)}", flush=True)
    
    # 2. Normalize raw transactions
    print(f"[ORCHESTRATOR] 3. Starting transaction normalization", flush=True)
    txs = NormalizationEngine.normalize(raw_txs, account_id)
    print(f"[ORCHESTRATOR] 4. Normalization complete. Normalized Txs: {len(txs)}", flush=True)
    
    # 3. Extract entities
    print(f"[ORCHESTRATOR] 5. Starting entity extraction", flush=True)
    entities = EntityExtractor.extract_all(txs)
    print(f"[ORCHESTRATOR] 6. Entity extraction complete", flush=True)
    
    # 4. Detect patterns (runs BEFORE scoring)
    print(f"[ORCHESTRATOR] 7. Starting pattern detection", flush=True)
    patterns_data = PatternDetectionEngine.detect(txs, account_id)
    patterns = patterns_data.get("patterns", [])
    print(f"[ORCHESTRATOR] 8. Pattern detection complete. Patterns found: {len(patterns)}", flush=True)
    
    # 5. Generate case ID and build initial money flow graph
    case_id = f"INV-{uuid.uuid4().hex[:6].upper()}"
    print(f"[ORCHESTRATOR] 9. Generated Case ID: {case_id}. Building money flow graph", flush=True)
    graph = build_money_flow_graph(case_id, txs, entities, store)
    print(f"[ORCHESTRATOR] 10. Initial graph generated", flush=True)

    # 6. Compute modular financial metrics
    print(f"[ORCHESTRATOR] 11. Computing modular financial metrics", flush=True)
    from app.engines.financial_metrics.metrics_engine import FinancialMetricsEngine
    entities_copy = dict(entities)
    entities_copy["patterns"] = patterns
    metrics = FinancialMetricsEngine.compute_metrics(txs, entities_copy, graph)
    print(f"[ORCHESTRATOR] 12. Modular financial metrics computed", flush=True)

    # Re-build graph to include metrics on nodes
    print(f"[ORCHESTRATOR] 13. Rebuilding graph with metrics", flush=True)
    graph = build_money_flow_graph(case_id, txs, entities, store, metrics)
    print(f"[ORCHESTRATOR] 14. Graph rebuilt successfully", flush=True)
    
    # 7. Score investigation using modular metrics
    print(f"[ORCHESTRATOR] 15. Scoring investigation", flush=True)
    risk_data = score_investigation(txs, patterns, account_id, entities_copy, graph, metrics)
    print(f"[ORCHESTRATOR] 16. Investigation scored. Risk Score: {risk_data.get('risk_score')}", flush=True)
    
    # 8. Create Case Manager entry
    print(f"[ORCHESTRATOR] 17. Creating Case Manager entry", flush=True)
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
    print(f"[ORCHESTRATOR] 18. Case Manager entry created", flush=True)
    
    # 9. Build timeline
    print(f"[ORCHESTRATOR] 19. Generating chronological audit timeline", flush=True)
    timeline = TimelineGenerator.generate(txs, patterns, entities, graph, risk_data.get("risk_score", 0.0))
    print(f"[ORCHESTRATOR] 20. Timeline generated. Case timeline event count: {len(timeline['case_timeline'])}", flush=True)
    
    # 10. Generate report with pre-calculated metrics
    print(f"[ORCHESTRATOR] 21. Generating report", flush=True)
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
    print(f"[ORCHESTRATOR] 22. Report generated successfully", flush=True)
    
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
    update_search_index(case_id, entities, account_id, store)
    print(f"[ORCHESTRATOR] 26. Search index updated. All pipeline processes finished.", flush=True)
    
    return {
        "case_id": case_id,
        "case": case,
        "summary": report.get("executive_summary"),
        "parser_stats": parser_stats
    }


def process_statements(file_paths: List[str], original_filenames: List[str], store: dict) -> Dict[str, Any]:
    """
    Process multiple uploaded bank statements, merge them, and build a single unified case.
    """
    print(f"[ORCHESTRATOR] Starting multi-statement processing for {len(file_paths)} files", flush=True)
    
    files_uploaded = []
    account_ids = []
    all_txs = []
    
    # 1. Parse and normalize each file independently
    for file_path, filename in zip(file_paths, original_filenames):
        try:
            print(f"[ORCHESTRATOR] Parsing file: {filename}", flush=True)
            parser = StatementParser()
            account_id, raw_txs, parser_stats = parser.parse_statement(file_path)
            
            print(f"[ORCHESTRATOR] Parsed {filename} successfully. Account: {account_id}, Txs: {len(raw_txs)}", flush=True)
            txs = NormalizationEngine.normalize(raw_txs, account_id)
            
            # Label each transaction with its source file name
            for tx in txs:
                tx["source_file"] = filename
                
            all_txs.extend(txs)
            account_ids.append(account_id)
            
            files_uploaded.append({
                "filename": filename,
                "status": "SUCCESS",
                "account_id": account_id,
                "confidence": float(parser_stats.get("confidence", 100.0)),
                "rows_parsed": int(parser_stats.get("parsed_rows", len(txs))),
                "total_rows": int(parser_stats.get("total_rows", len(txs))),
                "skipped_rows": int(parser_stats.get("skipped_rows", 0)),
                "warnings": parser_stats.get("warnings", []),
                "source_format": parser_stats.get("source_format", "Unknown")
            })
            
        except Exception as e:
            print(f"[ORCHESTRATOR] Failed to parse file {filename}: {str(e)}", flush=True)
            import traceback
            traceback.print_exc()
            files_uploaded.append({
                "filename": filename,
                "status": "FAILED",
                "account_id": "N/A",
                "confidence": 0.0,
                "rows_parsed": 0,
                "total_rows": 0,
                "skipped_rows": 0,
                "warnings": [f"Error: {str(e)}"],
                "source_format": "Unknown"
            })
            
    # Check if we have at least one successfully parsed statement
    successful_files = [f for f in files_uploaded if f["status"] == "SUCCESS"]
    if not successful_files:
        raise ValueError("None of the uploaded bank statements could be parsed successfully.")
        
    primary_acc = successful_files[0]["account_id"]
    
    # 2. Sort merged transactions chronologically
    all_txs.sort(key=lambda x: x["date"])
    
    # 3. Cross-statement transaction linking (heuristic)
    for tx in all_txs:
        desc_upper = tx.get("description", "").upper()
        for other_id in account_ids:
            if other_id != tx.get("sender_account") and other_id != tx.get("receiver_account") and other_id in desc_upper:
                if tx.get("is_debit", True):
                    tx["receiver_account"] = other_id
                else:
                    tx["sender_account"] = other_id

    # 4. Extract entities globally
    print(f"[ORCHESTRATOR] Starting global entity extraction on {len(all_txs)} transactions", flush=True)
    entities = EntityExtractor.extract_all(all_txs)
    
    # Enrich entities with referencing source files
    tx_file_map = {tx["tx_id"]: tx.get("source_file", "Unknown") for tx in all_txs}
    for entity_list in entities.values():
        for ent in entity_list:
            ent_files = {tx_file_map[tid] for tid in ent.get("source_tx_ids", []) if tid in tx_file_map}
            ent["source_files"] = list(ent_files)
            
    print(f"[ORCHESTRATOR] Entity extraction complete", flush=True)
    
    # 5. Detect patterns globally
    print(f"[ORCHESTRATOR] Starting global pattern detection", flush=True)
    patterns_data = PatternDetectionEngine.detect(all_txs, primary_acc)
    patterns = patterns_data.get("patterns", [])
    print(f"[ORCHESTRATOR] Pattern detection complete. Patterns found: {len(patterns)}", flush=True)
    
    # 6. Generate Case ID and build initial graph
    case_id = f"INV-{uuid.uuid4().hex[:6].upper()}"
    print(f"[ORCHESTRATOR] Generated Case ID: {case_id}. Building money flow graph", flush=True)
    graph = build_money_flow_graph(case_id, all_txs, entities, store)
    
    # 7. Compute financial metrics
    print(f"[ORCHESTRATOR] Computing financial metrics", flush=True)
    from app.engines.financial_metrics.metrics_engine import FinancialMetricsEngine
    entities_copy = dict(entities)
    entities_copy["patterns"] = patterns
    metrics = FinancialMetricsEngine.compute_metrics(all_txs, entities_copy, graph)
    
    # Rebuild graph to include metrics
    graph = build_money_flow_graph(case_id, all_txs, entities, store, metrics)
    
    # 8. Score investigation
    risk_data = score_investigation(all_txs, patterns, primary_acc, entities_copy, graph, metrics)
    risk_score = risk_data.get("risk_score", 0.0)
    
    # Consolidated parser stats
    avg_confidence = sum(f["confidence"] for f in successful_files) / len(successful_files)
    total_parsed = sum(f["rows_parsed"] for f in files_uploaded)
    total_rows = sum(f["total_rows"] for f in files_uploaded)
    total_skipped = sum(f["skipped_rows"] for f in files_uploaded)
    all_warnings = []
    for f in files_uploaded:
        all_warnings.extend(f["warnings"])
        
    parser_stats = {
        "total_rows": total_rows,
        "parsed_rows": total_parsed,
        "skipped_rows": total_skipped,
        "confidence": round(avg_confidence, 2),
        "warnings": all_warnings,
        "source_format": "Multi-Statement"
    }
    
    # 9. Create Case Manager entry
    case = CaseManager.create_investigation(
        case_id=case_id,
        account_id=primary_acc,
        risk_data=risk_data,
        transactions=all_txs,
        patterns=patterns,
        entities=entities,
        parser_stats=parser_stats,
        source_file=", ".join(f["filename"] for f in successful_files),
        store=store,
        account_ids=account_ids,
        files_uploaded=files_uploaded
    )
    
    # 10. Generate timeline
    print(f"[ORCHESTRATOR] Generating chronological timeline", flush=True)
    timeline = TimelineGenerator.generate(all_txs, patterns, entities, graph, risk_score)
    
    # Add source_file reference to timeline events
    for category in ["case_timeline", "suspicious_timeline", "money_trail_timeline", "risk_escalation_timeline", "entity_timeline"]:
        if category in timeline:
            for event in timeline[category]:
                txs_list = event.get("transactions", [])
                if txs_list and txs_list[0] in tx_file_map:
                    event["source_file"] = tx_file_map[txs_list[0]]
                else:
                    event["source_file"] = "N/A"
                    
    # 11. Generate report
    report = ReportGenerator.generate_report(
        case=case,
        transactions=all_txs,
        patterns_data=patterns_data,
        entities=entities,
        graph=graph,
        timeline=timeline,
        parser_stats=parser_stats,
        metrics=metrics
    )
    
    # Inject files_uploaded into report
    report["files_uploaded"] = files_uploaded
    
    # Save report to store
    store.setdefault("reports", {})
    store["reports"][case_id] = report
    
    store.setdefault("transactions", {})
    for tx in all_txs:
        tx["case_id"] = case_id
        tx["risk_score"] = risk_score
        store["transactions"][tx["tx_id"]] = tx
        
    # Update search index
    for acc in account_ids:
        update_search_index(case_id, entities, acc, store)
        
    return {
        "case_id": case_id,
        "case": case,
        "summary": report.get("executive_summary"),
        "parser_stats": parser_stats
    }

