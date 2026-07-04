# Integration Checklist for Tanish's Branch

Use this checklist to ensure a smooth integration of the Global Financial Intelligence Engine.

## Pre-Integration (1 min)

- [ ] Extract analytics_export folder to a working location
- [ ] Read `README.md` to understand what's being integrated
- [ ] Verify Tanish's SENTINEL branch is clean and on the Tanish branch
- [ ] Backup Tanish's `main.py` and `App.jsx` (just in case)

## Copy Phase (2 min)

### Option A: Manual Copy
- [ ] Copy `analytics_export/backend/app/analytics/` → `Tanish-Sentinel/backend/app/analytics/`
- [ ] Copy `analytics_export/frontend/src/hooks/useFinancialIntelligenceStore.js` → `Tanish-Sentinel/frontend/src/hooks/`
- [ ] Copy `analytics_export/frontend/src/pages/FinancialIntelligence.jsx` → `Tanish-Sentinel/frontend/src/pages/`
- [ ] Copy `analytics_export/database/analytics.db` → `Tanish-Sentinel/backend/` (optional - let it auto-create if you prefer)

### Option B: Use Script
```bash
cd analytics_export
./COPY_TO_SENTINEL.bat "C:\path\to\Tanish-Sentinel"
```

## Code Integration (3 min)

### File 1: `backend/main.py`

**Section A: Add imports (after existing imports)**
- [ ] Find the line: `from app.services.orchestrator import process_statement, process_statements_batch`
- [ ] Add after it:
  ```python
  from app.analytics.analytics_api import router as analytics_router
  from app.analytics.bulk_loader import ingest_file
  ```

**Section B: Mount router (after middleware)**
- [ ] Find the `app.add_middleware(CORSMiddleware, ...)` block
- [ ] Add after it:
  ```python
  app.include_router(analytics_router)
  ```

**Section C: Add ingestion hook (in upload_statement function)**
- [ ] Find the line: `result = process_statements_batch(file_paths, data_store)`
- [ ] Add after it (before the `return` statement):
  ```python
  # Analytics (Global Financial Intelligence Engine) — additive, non-blocking
  try:
      for fp in file_paths:
          ingest_file(fp)
  except Exception as analytics_err:
      print(f"[analytics] non-fatal ingestion error: {analytics_err}")
  ```

**Verification:**
- [ ] File contains all 3 sections
- [ ] Indentation matches existing code
- [ ] File is syntactically valid: `python -m py_compile main.py`

### File 2: `frontend/src/App.jsx`

**Section A: Add import**
- [ ] Find line with: `import FinancialIntelligence from './pages/FinancialIntelligence';`
- [ ] Or add it after other page imports

**Section B: Add to icon imports**
- [ ] Find the line with lucide-react imports
- [ ] Add `Globe` to the import list:
  ```javascript
  import {
    UploadCloud, LayoutDashboard, FileText, Search,
    ShieldAlert, LogOut, GitBranch, ArrowRight, User, Globe
  } from 'lucide-react';
  ```

**Section C: Add route**
- [ ] Find the `<Routes>` block
- [ ] Add after existing routes:
  ```javascript
  <Route path="/financial-intelligence" element={<ErrorBoundary><FinancialIntelligence /></ErrorBoundary>} />
  ```

**Section D: Add nav link**
- [ ] Find the `NavigationSidebar` component
- [ ] Find the last nav link (likely `Investigations`)
- [ ] Add after it:
  ```javascript
  <Link
    to="/financial-intelligence"
    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${getActiveCls('/financial-intelligence')}`}
  >
    <Globe size={16} />
    Financial Intelligence
  </Link>
  ```

**Verification:**
- [ ] All 4 sections added
- [ ] Syntax is correct (check for matching braces/parens)
- [ ] File has no React warnings when opened in IDE

## Testing Phase (5 min)

### Backend Tests

- [ ] Start backend: `cd backend && python main.py`
- [ ] Check for import errors (should not appear in console)
- [ ] Test health endpoint: `curl http://localhost:8000/health`
- [ ] Test analytics endpoint: `curl http://localhost:8000/analytics/cycles`
  - Expected: JSON response with cycles data (may be empty if using fresh DB)
- [ ] Stop and restart server
  - If you copied `analytics.db`, it should load existing data
  - If not, it will create a fresh empty database

### Frontend Tests

- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Open browser: `http://localhost:5173` (or your Vite port)
- [ ] Look for new **"Financial Intelligence"** nav item with Globe icon
- [ ] Click the nav item
- [ ] You should see 5 tabs:
  - [ ] Circular Money Traversal
  - [ ] Global Graph
  - [ ] Money Trails
  - [ ] Top Money Hubs
  - [ ] Cross-Statement Search

### Integration Test

- [ ] Upload a statement via the UI (Investigation Mode)
- [ ] Check that it appears in both:
  - [ ] `/investigation/{id}` (Investigation Mode - existing)
  - [ ] `/analytics/account/{account_id}` (Intelligence Mode - new)

## Data Verification (2 min)

If you copied the pre-populated `analytics.db`:

- [ ] Query cycles: `curl http://localhost:8000/analytics/cycles`
  - Should return data with existing cycles
- [ ] Check graph: `curl http://localhost:8000/analytics/global-graph`
  - Should show 92 accounts, 48,614 transactions
- [ ] List top hubs: `curl http://localhost:8000/analytics/top-money-hubs`
  - Should show ranked accounts

If you're using a fresh database:

- [ ] All endpoints should work but return empty/minimal data
- [ ] Upload test statements to populate it

## Rollback Plan (if needed)

If something breaks:

1. **Restore files from backup:**
   ```bash
   cp main.py.backup main.py
   cp App.jsx.backup App.jsx
   ```

2. **Delete new files:**
   ```bash
   rm -rf backend/app/analytics/
   rm frontend/src/hooks/useFinancialIntelligenceStore.js
   rm frontend/src/pages/FinancialIntelligence.jsx
   ```

3. **Delete database (optional):**
   ```bash
   rm backend/analytics.db
   ```

4. **Restart server** - should work exactly as before

## Post-Integration (Optional)

### Create Test Cycle

To test cross-statement cycle detection:

1. Create 3 small CSV files with account data:
   ```
   File 1: Account_A → Account_B (100)
   File 2: Account_B → Account_C (100)
   File 3: Account_C → Account_A (100)
   ```

2. Upload all 3 files via the UI

3. Navigate to Financial Intelligence → Circular Money Traversal

4. You should see a cycle with 3 hops detected ✓

### Monitor Database Growth

Each time someone uploads a statement:
- New rows appear in `analytics.db`
- Accessible via `/analytics/account/{id}`
- Cycles are automatically re-detected when you query `/analytics/cycles`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Module not found: app.analytics" | Verify `analytics/` folder is in `backend/app/` |
| 404 on `/analytics/cycles` | Ensure `app.include_router(analytics_router)` in main.py |
| Frontend page shows blank | Check browser console for errors; verify .jsx file copied |
| Database locked error | Close any other SENTINEL instances |
| Syntax errors in main.py | Compare with `MAIN_PY_PATCH.md` for exact indentation |
| Missing Globe icon | Ensure `Globe` is in lucide-react imports in App.jsx |

## Final Checklist

- [ ] All files copied
- [ ] Both Python files edited (main.py, analytics_api.py working)
- [ ] App.jsx edited (route + nav link added)
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] `/analytics/cycles` endpoint works
- [ ] Navigation shows "Financial Intelligence" item
- [ ] Dashboard page loads
- [ ] At least one tab renders correctly

## Success Criteria

✅ System is successfully integrated when:
1. Existing Investigation Mode works exactly as before
2. New `/financial-intelligence` page is accessible and loads
3. `/analytics/cycles` endpoint returns data (or valid empty response)
4. Navigation includes "Financial Intelligence" with Globe icon
5. Uploading a statement doesn't cause errors in analytics module

---

**Integration Time**: ~10 minutes  
**Rollback Time**: ~2 minutes (if needed)  
**Risk Level**: ZERO (isolated, can be completely removed)  

**Next**: Once integration is verified, read `INTEGRATION_GUIDE.md` for advanced features and architecture details.
