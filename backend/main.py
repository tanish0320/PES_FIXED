import os
import shutil
from typing import Any, List, Dict
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.data_store import data_store
from app.services.orchestrator import process_statement
from app.engines.cross_statement_intelligence import CrossStatementIntelligenceEngine

app = FastAPI(title="SENTINEL - AI Financial Investigation Workstation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from copilot.api import router as copilot_router
app.include_router(copilot_router)

# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "Sentinel Investigation Workstation is healthy"}

@app.post("/upload")
async def upload_statement(file: UploadFile = File(...)):
    """
    Accepts an uploaded bank statement (.pdf, .csv, .xlsx, .xls, .txt), 
    runs the full analysis pipeline, and returns case details.
    """
    # Save statement to disk
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        result = process_statement(file_path, file.filename, data_store)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to analyze statement: {str(e)}")

@app.get("/investigations")
def get_investigations() -> List[Dict[str, Any]]:
    """
    List all processed investigations with risk scores.
    """
    cases = data_store.get("cases", {})
    # Return cases sorted by risk score descending
    return sorted(cases.values(), key=lambda x: x.get("risk_score", 0.0), reverse=True)

@app.get("/investigation/{case_id}")
def get_investigation_detail(case_id: str) -> Dict[str, Any]:
    """
    Returns full investigation details including transactions, patterns, graph, and timeline.
    """
    case = data_store.get("cases", {}).get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Investigation case not found")
        
    report = data_store.get("reports", {}).get(case_id, {})
    graph = data_store.get("graphs", {}).get(case_id, {"nodes": [], "edges": []})
    
    # Fetch full transaction objects
    tx_ids = case.get("transactions", [])
    tx_store = data_store.get("transactions", {})
    transactions = [tx_store[tid] for tid in tx_ids if tid in tx_store]
    
    patterns = report.get("detected_patterns", [])
    timeline = report.get("timeline", [])
    
    return {
        "case": case,
        "transactions": transactions,
        "patterns": patterns,
        "graph": graph,
        "timeline": timeline,
        "report": report
    }

@app.get("/investigation/{case_id}/report")
def get_investigation_report(case_id: str) -> Dict[str, Any]:
    """
    Returns the formatted investigation report JSON.
    """
    report = data_store.get("reports", {}).get(case_id)
    if not report:
        raise HTTPException(status_code=404, detail="Investigation report not found")
    return report

@app.get("/stats")
def get_investigation_stats() -> Dict[str, Any]:
    """
    Returns workstation dashboard KPIs and chart distributions.
    """
    cases = list(data_store.get("cases", {}).values())
    tx_store = data_store.get("transactions", {})
    
    statements_uploaded = len(cases)
    investigations_created = len(cases)
    high_risk_investigations = sum(1 for c in cases if c.get("risk_score", 0) >= 60)
    
    # Count unique high risk transactions
    high_risk_tx_ids = set()
    for c in cases:
        for tid in c.get("high_risk_transactions", []):
            high_risk_tx_ids.add(tid)
            
    high_risk_transactions_count = len(high_risk_tx_ids)
    if not high_risk_transactions_count:
        high_risk_transactions_count = sum(1 for tx in tx_store.values() if tx.get("risk_score", 0) >= 60)
        
    total_volume = sum(float(tx.get("amount", 0.0)) for tx in tx_store.values())

    # 1. Risk level distribution
    risk_dist = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for c in cases:
        rl = c.get("risk_level", "LOW").upper()
        if rl in risk_dist:
            risk_dist[rl] += 1
            
    # 2. Channel distribution
    channel_dist = {}
    for tx in tx_store.values():
        ch = tx.get("channel", "OTHER").upper()
        channel_dist[ch] = channel_dist.get(ch, 0) + 1
        
    # 3. Pattern distribution
    pattern_dist = {}
    for c in cases:
        for pat in c.get("patterns_detected", []):
            pattern_dist[pat] = pattern_dist.get(pat, 0) + 1
            
    # 4. Timeline activity (volume and count over time across all investigations)
    timeline_map = {} # date -> {"volume": float, "count": int}
    for tx in tx_store.values():
        ts = tx.get("timestamp", "")
        if ts and len(ts) >= 10:
            date_str = ts[:10] # YYYY-MM-DD
            if date_str not in timeline_map:
                timeline_map[date_str] = {"volume": 0.0, "count": 0}
            timeline_map[date_str]["volume"] += float(tx.get("amount", 0.0))
            timeline_map[date_str]["count"] += 1
            
    # Convert timeline activity to sorted list
    timeline_activity = []
    for d, metrics in sorted(timeline_map.items()):
        timeline_activity.append({
            "date": d,
            "volume": round(metrics["volume"], 2),
            "count": metrics["count"]
        })
    # Limit to latest 30 days of activity
    timeline_activity = timeline_activity[-30:]
    
    return {
        "statements_uploaded": statements_uploaded,
        "investigations_created": investigations_created,
        "high_risk_investigations": high_risk_investigations,
        "high_risk_transactions": high_risk_transactions_count,
        "total_volume": total_volume,
        "risk_distribution": risk_dist,
        "channel_distribution": channel_dist,
        "pattern_distribution": pattern_dist,
        "timeline_activity": timeline_activity
    }


@app.get("/search")
def search_entities(q: str = Query(..., min_length=1), type: str = "all") -> List[Dict[str, Any]]:
    """
    Searches across ALL uploaded investigations, including Cases, Transactions,
    Entities, Reports, Timeline Events, and Graph Nodes.
    """
    results = []
    q_low = q.lower().strip()
    if not q_low:
        return []

    # 1. Search Cases
    cases = data_store.get("cases", {})
    for cid, case in cases.items():
        if q_low in cid.lower() or q_low in case.get("source_file", "").lower() or q_low in case.get("account_id", "").lower():
            results.append({
                "case_id": cid,
                "type": "case",
                "value": case.get("source_file", cid),
                "context": f"Case File - Account {case.get('account_id')} (Risk: {case.get('risk_score')})",
                "risk_score": case.get("risk_score", 0),
                "risk_level": case.get("risk_level", "LOW")
            })

    # 2. Search Transactions
    tx_store = data_store.get("transactions", {})
    for tid, tx in tx_store.items():
        desc = tx.get("description", "").lower()
        sender = tx.get("sender_account", "").lower()
        receiver = tx.get("receiver_account", "").lower()
        if q_low in tid.lower() or q_low in desc or q_low in sender or q_low in receiver:
            cid = tx.get("case_id", "global")
            case = cases.get(cid, {})
            results.append({
                "case_id": cid,
                "type": "transaction",
                "value": f"{tx.get('channel', 'TRANSFER')} transaction of ₹{tx.get('amount')}",
                "context": f"Narration: {tx.get('description')} ({tx.get('date').strftime('%Y-%m-%d') if hasattr(tx.get('date'), 'strftime') else tx.get('date')})",
                "risk_score": case.get("risk_score", 0),
                "risk_level": case.get("risk_level", "LOW")
            })

    # 3. Search Extracted Entities index
    search_index = data_store.get("search_index", {})
    for key, entries in search_index.items():
        if q_low in key:
            for entry in entries:
                if type == "all" or entry["type"] == type:
                    case = cases.get(entry["case_id"], {})
                    results.append({
                        **entry,
                        "risk_score": case.get("risk_score", 0),
                        "risk_level": case.get("risk_level", "LOW")
                    })

    # 4. Search Timeline Events
    reports = data_store.get("reports", {})
    for cid, report in reports.items():
        case = cases.get(cid, {})
        # Check standard timeline list
        timeline = report.get("timeline", [])
        for evt in timeline:
            if q_low in evt.get("event", "").lower() or q_low in evt.get("counterparty", "").lower() or q_low in evt.get("description", "").lower():
                results.append({
                    "case_id": cid,
                    "type": "timeline_event",
                    "value": evt.get("event"),
                    "context": f"Timeline Milestone - {evt.get('date')} {evt.get('time')} ({evt.get('event_type', 'Audit')})",
                    "risk_score": case.get("risk_score", 0),
                    "risk_level": case.get("risk_level", "LOW")
                })

    # 5. Search Graph Nodes
    graphs = data_store.get("graphs", {})
    for cid, graph in graphs.items():
        case = cases.get(cid, {})
        for node in graph.get("nodes", []):
            # Check data contents
            nd = node.get("data", {})
            label = str(nd.get("label", "")).lower()
            node_id = str(nd.get("id", "")).lower()
            node_type = str(nd.get("nodeType", "")).lower()
            if q_low in label or q_low in node_id or q_low in node_type:
                results.append({
                    "case_id": cid,
                    "type": "graph_node",
                    "value": nd.get("label", nd.get("id")),
                    "context": f"Graph Node ({nd.get('nodeType', 'Account')}) - Case {case.get('source_file')}",
                    "risk_score": case.get("risk_score", 0),
                    "risk_level": case.get("risk_level", "LOW")
                })

    # Deduplicate results
    deduped = []
    seen = set()
    for res in results:
        uniq_key = (res["case_id"], res["type"], str(res["value"]))
        if uniq_key not in seen:
            seen.add(uniq_key)
            deduped.append(res)
            
    return deduped

@app.get("/cross-statement-intelligence")
def get_cross_statement_intelligence() -> Dict[str, Any]:
    """
    Returns correlated entity profiles, repeated beneficiaries, bridge accounts, similarity scores,
    and investigation relationship graph across all uploaded statements.
    """
    try:
        return CrossStatementIntelligenceEngine.analyze(data_store)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate cross-statement intelligence: {str(e)}")

@app.post("/seed-demo")
def seed_demo_data():
    """
    Auto-processes 3-5 primary statements to pre-populate the workstation dashboard.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_dir = os.path.join(base_dir, "Bank-statements-dataset")
    
    files_to_seed = [
        # Primary PDFs
        os.path.join(dataset_dir, "primary", "00869354051.pdf"),
        os.path.join(dataset_dir, "primary", "08874795659248.pdf"),
        os.path.join(dataset_dir, "primary", "17771917925.pdf"),
        # Secondary CSV / TXT
        os.path.join(dataset_dir, "Secondary", "958533930537174-14-02-2024to11-12-2025.pdf"),
        os.path.join(dataset_dir, "Secondary", "shivlal statement.txt")
    ]
    
    seeded = []
    errors = []
    
    for fp in files_to_seed:
        if os.path.exists(fp):
            try:
                filename = os.path.basename(fp)
                temp_path = os.path.join(UPLOAD_DIR, filename)
                shutil.copyfile(fp, temp_path)
                
                result = process_statement(temp_path, filename, data_store)
                seeded.append({
                    "filename": filename,
                    "case_id": result["case_id"],
                    "risk_score": result["case"].get("risk_score"),
                    "risk_level": result["case"].get("risk_level")
                })
            except Exception as e:
                errors.append(f"Failed to process {os.path.basename(fp)}: {str(e)}")
        else:
            errors.append(f"File not found: {os.path.basename(fp)}")
            
    return {
        "status": "success" if seeded else "failed",
        "seeded_count": len(seeded),
        "seeded": seeded,
        "errors": errors
    }

@app.post("/log")
def log_message(payload: dict) -> dict:
    print(f"[FRONTEND LOG] {payload.get('msg')}")
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
