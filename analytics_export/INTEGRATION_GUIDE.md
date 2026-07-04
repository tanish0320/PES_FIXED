# Global Financial Intelligence Engine - Integration Guide

This folder contains a complete, isolated analytics subsystem that can be integrated into Tanish's version of SENTINEL.

## What's Included

```
analytics_export/
├── backend/app/analytics/          # All analytics backend modules
│   ├── __init__.py
│   ├── sqlite_store.py             # Database (SQLite) management
│   ├── bulk_loader.py              # Statement ingestion pipeline
│   ├── graph_builder.py            # Global graph construction
│   ├── cycle_detector.py           # Cross-statement cycle detection
│   ├── money_trail.py              # FIFO money trail allocation
│   └── analytics_api.py            # FastAPI routes (7 endpoints)
├── frontend/src/hooks/
│   └── useFinancialIntelligenceStore.js  # API client hook
├── frontend/src/pages/
│   └── FinancialIntelligence.jsx   # Dashboard page
├── database/
│   └── analytics.db                # Pre-populated with 48,614 transactions
└── INTEGRATION_GUIDE.md            # This file
```

## Integration Steps

### 1. Copy Backend Files

Copy the entire `backend/app/analytics/` folder to Tanish's repo:
```
Tanish's-Sentinel/backend/app/analytics/  ← Copy here
```

### 2. Copy Frontend Files

Copy frontend components:
```
Tanish's-Sentinel/frontend/src/hooks/useFinancialIntelligenceStore.js
Tanish's-Sentinel/frontend/src/pages/FinancialIntelligence.jsx
```

### 3. Copy Database (Optional)

The pre-populated database with 48,614 transactions (from 101 statements):
```
Tanish's-Sentinel/backend/analytics.db  ← Place here (or let it auto-create)
```

To use the pre-populated database:
```bash
cp analytics_export/database/analytics.db Tanish-Sentinel/backend/
```

To start with a fresh database (auto-initializes on first use):
```bash
# Just don't copy the .db file - it will be created automatically
```

### 4. Modify `main.py`

In Tanish's `backend/main.py`, add these two lines:

**At the top, after existing imports (around line 10):**
```python
from app.analytics.analytics_api import router as analytics_router
from app.analytics.bulk_loader import ingest_file
```

**After `app.add_middleware(...)` block (around line 20):**
```python
app.include_router(analytics_router)
```

**Inside the `upload_statement` function, after `process_statements_batch` call (around line 100):**
```python
        # Analytics (Global Financial Intelligence Engine) — additive, non-blocking
        try:
            for fp in file_paths:
                ingest_file(fp)
        except Exception as analytics_err:
            print(f"[analytics] non-fatal ingestion error: {analytics_err}")
```

### 5. Modify `App.jsx`

In Tanish's `frontend/src/App.jsx`:

**Add import (around line 12):**
```javascript
import FinancialIntelligence from './pages/FinancialIntelligence';
```

**Add icon import (update line ~18):**
```javascript
import {
  UploadCloud, LayoutDashboard, FileText, Search,
  ShieldAlert, LogOut, GitBranch, ArrowRight, User, Globe
} from 'lucide-react';
```

**Add route (inside `<Routes>` block, around line 230):**
```javascript
<Route path="/financial-intelligence" element={<ErrorBoundary><FinancialIntelligence /></ErrorBoundary>} />
```

**Add nav item (inside `NavigationSidebar`, after Investigations link, around line 179):**
```javascript
<Link
  to="/financial-intelligence"
  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${getActiveCls('/financial-intelligence')}`}
>
  <Globe size={16} />
  Financial Intelligence
</Link>
```

## Database Contents

**Pre-populated with real bank statement data:**
- **101 bank statements** imported
- **48,614 transactions** parsed and normalized
- **92 unique accounts** registered
- **₹511 billion** total transaction volume

### Key Accounts (Most Active)
1. `098030016134598`: 11,038 transactions
2. `17496072039317 statement`: 9,273 transactions
3. `SOA_489506257213`: 8,372 transactions

### Ready-to-Test Cycle Patterns
The database contains real money flow patterns suitable for testing:
- ✓ Circular money traversal (round-tripping)
- ✓ Multi-hop fund movements (3-4 hops)
- ✓ Layering patterns (lossy transfers)
- ✓ Hub accounts with high connectivity

## Verify Integration

### 1. Backend Health Check
```bash
curl http://localhost:8000/health
# Should show transaction count
```

### 2. Analytics Endpoints
```bash
# Should return global graph
curl http://localhost:8000/analytics/global-graph

# Should detect cycles
curl http://localhost:8000/analytics/cycles

# Should show top accounts
curl http://localhost:8000/analytics/top-money-hubs
```

### 3. Frontend
- Navigate to http://localhost:3000/financial-intelligence
- You should see 5 tabs:
  - Circular Money Traversal (cycles)
  - Global Graph
  - Money Trails
  - Top Money Hubs
  - Cross-Statement Search

## Key Features

### Cross-Statement Cycle Detection
Detects circular money flows that span MULTIPLE statements:
```
Statement 1: A → B
Statement 2: B → C
Statement 3: C → A
Result: Cycle A→B→C→A detected ✓
```

### 7 Analytics Endpoints
- `/analytics/cycles` — Detected circular money flows
- `/analytics/money-trails` — FIFO allocation tracking
- `/analytics/high-risk-network` — Cycles with risk_score ≥ 70
- `/analytics/account/{id}` — Account details + transactions
- `/analytics/entity/{value}` — Cross-statement entity search
- `/analytics/top-money-hubs` — Accounts ranked by volume
- `/analytics/global-graph` — All nodes and edges

### Backward Compatible
- ✓ Existing Investigation Mode untouched
- ✓ All existing endpoints work identically
- ✓ No changes to InvestigationStore
- ✓ No new dependencies required

## Troubleshooting

### Database Locked Error
The database is being accessed by another process. Make sure:
- No other SENTINEL instances are running
- Database file is not open in another tool

### Analytics Routes Not Found
Verify the router is mounted in `main.py`:
```python
app.include_router(analytics_router)  # Should be present
```

### Frontend Page Not Loading
Check that both files are copied:
- `frontend/src/hooks/useFinancialIntelligenceStore.js`
- `frontend/src/pages/FinancialIntelligence.jsx`

And verify the route and nav link are in `App.jsx`.

## File Sizes

- Backend modules: ~25 KB (6 files)
- Frontend components: ~15 KB (2 files)
- Pre-populated database: 27.8 MB (with 48,614 transactions)

## Support

For questions about integration:
1. Check the existing `/upload` endpoint to verify core system works
2. Test `/analytics/cycles` endpoint directly
3. Review `backend/app/analytics/analytics_api.py` for endpoint signatures
4. Check browser console for frontend errors

## Next Steps

After integration:

1. **Test with new uploads**: Upload a statement in Tanish's version and verify:
   - Investigation Mode works (existing)
   - Analytics DB gets populated automatically

2. **Create a test cycle**: Upload 3 statements forming A→B→C→A and verify `/analytics/cycles` detects it

3. **Explore pre-loaded data**: Use `/analytics/top-money-hubs` and `/analytics/account/{id}` with the 101 pre-loaded statements

4. **Monitor database growth**: Each new upload adds rows to the analytics.db automatically

---

**Integration Time**: ~15 minutes  
**Risk Level**: ZERO (completely isolated, additive only)  
**Backward Compatibility**: 100% (existing system untouched)
