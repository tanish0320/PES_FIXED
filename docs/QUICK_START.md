# SENTINEL Quick Start Guide

## ✅ Servers Running

**Backend**: http://localhost:8000  
**Frontend**: http://localhost:5178 (or next available port)

---

## 🚀 What to Do Now

### 1. Open the Frontend
Go to **http://localhost:5178** in your browser to see the SENTINEL dashboard.

### 2. Upload a Bank Statement
- Click the upload area
- Select a PDF from: `Bank-statements-dataset/primary/` 
- Example: `00869354051.pdf`
- Wait for processing (2-5 seconds)

### 3. View Investigation Results
After upload, you'll see:
- **Risk Score** (0-100)
- **Risk Level** (LOW, MEDIUM, HIGH)
- **Transaction Graph** with nodes and edges
- **Detected Patterns** (circular flows, fan-out, structuring, etc.)
- **Money Cycles** (round-trip fund flows)
- **Financial Summary** (volume, timeframe)

### 4. Explore the Investigation
Click on the investigation to see:
- **Statements**: List of uploaded PDFs parsed
- **Transactions**: All individual transactions
- **Graph View**: Visual money flow network
- **Money Trails**: FIFO-allocated fund paths
- **Timeline**: Chronological transaction sequence
- **Report**: Full forensic analysis

---

## 🔧 Common Tasks

### Test with Different Files
```bash
# From Bank-statements-dataset/primary/:
- 00869354051.pdf
- 08874795659248.pdf  
- 17771917925.pdf
- 098030016134598.pdf
- 18306700003.pdf
```

### Check Backend Health
```bash
curl http://localhost:8000/health
```

### List All Investigations
```bash
curl http://localhost:8000/investigations | jq '.'
```

### Get Investigation Details
```bash
curl http://localhost:8000/investigation/{investigation_id} | jq '.'
```

### Get Risk Report
```bash
curl http://localhost:8000/investigation/{investigation_id}/report | jq '.executive_summary'
```

### Reset All Data
```bash
curl -X POST http://localhost:8000/reset
```

---

## 📊 System Architecture

```
Upload PDF
    ↓
Parser (extracts transactions)
    ↓
Normalizer (standardizes format)
    ↓
InvestigationStore (single source of truth)
    ↓
┌─────────────────────────────────┐
│ Analysis Engines                │
│ ├─ Account Linking              │
│ ├─ Pattern Detection            │
│ ├─ Graph Building               │
│ ├─ Cycle Detection              │
│ ├─ Money Trail Allocation (FIFO)│
│ ├─ Risk Scoring                 │
│ └─ Report Generation            │
└─────────────────────────────────┘
    ↓
Frontend Display
```

---

## 📁 Key Files

**Backend**:
- `backend/main.py` — API routes
- `backend/app/core/investigation_store.py` — Data storage abstraction
- `backend/app/services/orchestrator.py` — Pipeline orchestration
- `backend/app/engines/` — Analysis engines

**Frontend**:
- `frontend/src/hooks/useDataStore.js` — API client
- `frontend/src/modules/GraphModule/` — Graph visualization
- `frontend/src/pages/` — Main pages (Dashboard, Graph, Report, etc.)

**Test Data**:
- `Bank-statements-dataset/primary/` — Real bank statement PDFs
- `Bank-statements-dataset/Secondary/` — CSV statements

---

## 🎯 What Each Engine Does

| Engine | Purpose |
|--------|---------|
| **Parser** | Extracts transactions from PDFs/CSVs |
| **Entity Extractor** | Finds UPI IDs, names, merchants, IFSC codes |
| **Account Linker** | Links same account across multiple statements |
| **Pattern Detector** | Finds suspicious patterns (circular, fan-out, structuring) |
| **Graph Builder** | Creates money-flow network visualization |
| **Cycle Detector** | Finds round-trip fund movements |
| **Money Trail** | Allocates credits to debits via FIFO |
| **Risk Scorer** | Calculates risk score (0-100) |

---

## 🔍 Example Investigation Data

When you upload a PDF, you get:
```json
{
  "investigation_id": "INV-XXXXXXXX",
  "risk_score": 57.06,
  "risk_level": "HIGH",
  "statements": [{"statement_id": "STMT-XX", "transactions": 205, ...}],
  "transactions": 205,
  "linked_accounts": 1,
  "patterns": [{"name": "Coordinated Structuring", "severity": "Medium"}],
  "cycles": 3,
  "money_trails": 136,
  "total_volume": 30167840.0,
  "graph": {"nodes": 51, "edges": 205},
  "report": {"executive_summary": "..."}
}
```

---

## 💡 Tips

- **First time?** Start with a small PDF (85 KB) like `00869354051.pdf`
- **Want to explore?** Try different PDFs to see how risk scores vary
- **Check results?** Use the `/investigation/{id}/report` endpoint for forensic analysis
- **Reset everything?** `curl -X POST http://localhost:8000/reset`

---

## 🛠️ Troubleshooting

**Backend not responding?**
```bash
curl http://localhost:8000/health
```

**Frontend won't load?**
Check if port 5178 is in use. Frontend will try 5179, 5180, etc.

**Upload fails?**
- File must be a valid PDF or CSV
- Check backend console for parse errors
- Try a different file from `Bank-statements-dataset/`

---

## 📖 More Documentation

- `docs/IMPLEMENTATION_COMPLETE.md` — Full implementation summary
- `docs/BACKEND_TEST_RESULTS.md` — All endpoint tests
- `docs/REAL_DATA_TEST.md` — PDF upload verification
- `docs/QUICK_REFERENCE.md` — API reference

---

**Ready to explore SENTINEL!** 🚀

Upload a statement and watch the AI analyze financial transactions in real-time.
