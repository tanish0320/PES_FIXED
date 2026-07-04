# main.py Integration Patch

This shows exactly what needs to be added to `backend/main.py` in Tanish's branch.

## Step 1: Add Imports (Top of file, after existing imports)

**Location**: After line `from app.services.orchestrator import process_statement, process_statements_batch`

**Add these lines:**
```python
from app.analytics.analytics_api import router as analytics_router
from app.analytics.bulk_loader import ingest_file
```

## Step 2: Mount Router (After middleware setup)

**Location**: After the `app.add_middleware(CORSMiddleware, ...)` block (around line 20)

**Add this line:**
```python
app.include_router(analytics_router)
```

**Full context:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics_router)  # ← ADD THIS LINE

# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
```

## Step 3: Add Ingestion Hook (In upload_statement function)

**Location**: Inside the `upload_statement` function, immediately AFTER the line `result = process_statements_batch(file_paths, data_store)`

**Find this:**
```python
        result = process_statements_batch(file_paths, data_store)
        return {
            "investigation_id": result.get("investigation_id"),
            ...
        }
```

**Replace with:**
```python
        result = process_statements_batch(file_paths, data_store)

        # Analytics (Global Financial Intelligence Engine) — additive, non-blocking
        try:
            for fp in file_paths:
                ingest_file(fp)
        except Exception as analytics_err:
            print(f"[analytics] non-fatal ingestion error: {analytics_err}")

        return {
            "investigation_id": result.get("investigation_id"),
            ...
        }
```

## Complete Example (What your top of main.py should look like)

```python
import os
import shutil
import uuid
from typing import Any, List, Dict
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.data_store import data_store
from app.services.orchestrator import process_statement, process_statements_batch
from app.analytics.analytics_api import router as analytics_router
from app.analytics.bulk_loader import ingest_file

app = FastAPI(title="SENTINEL - AI Financial Investigation Workstation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics_router)

# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ... rest of code ...

@app.post("/upload")
async def upload_statement(files: List[UploadFile] = File(...)):
    """
    Accepts 1 or multiple bank statements (.pdf, .csv, .xlsx, .xls, .txt).
    Single file: creates investigation with 1 statement
    Multiple files: creates unified investigation with N statements + account linking
    """
    try:
        # Save files to disk
        file_paths = []
        for file in files:
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_paths.append(file_path)

        # Process using batch pipeline (handles single and multi-file)
        result = process_statements_batch(file_paths, data_store)

        # Analytics (Global Financial Intelligence Engine) — additive, non-blocking
        try:
            for fp in file_paths:
                ingest_file(fp)
        except Exception as analytics_err:
            print(f"[analytics] non-fatal ingestion error: {analytics_err}")

        return {
            "investigation_id": result.get("investigation_id"),
            "statements_count": result.get("statements_count"),
            "linked_accounts_count": result.get("linked_accounts_count"),
            "total_transactions": result.get("total_transactions"),
            "total_volume": result.get("total_volume"),
            "risk_score": result.get("risk_score"),
            "risk_level": result.get("risk_level")
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to analyze statements: {str(e)}")
```

## Why These Changes?

1. **Imports** — Load the analytics router and ingestion function
2. **Router Mount** — Register the `/analytics/*` routes with FastAPI
3. **Ingestion Hook** — After each upload, automatically add data to the global analytics database

## Testing the Changes

After adding these lines:

```bash
# 1. Verify imports work
python -c "from app.analytics.analytics_api import router; print('OK')"

# 2. Start the server
python main.py

# 3. Test endpoints
curl http://localhost:8000/health
curl http://localhost:8000/analytics/cycles

# 4. Upload a statement
curl -X POST http://localhost:8000/upload -F "file=@sample.csv"

# 5. Verify it was auto-ingested
curl http://localhost:8000/analytics/account/ACCOUNT_ID
```

## Safety Notes

- ✓ The ingestion hook is wrapped in `try/except`, so upload failures won't break existing functionality
- ✓ All analytics code is in a separate module (`app/analytics/`)
- ✓ No modifications to existing Investigation Mode code
- ✓ Zero dependencies added (sqlite3 is stdlib)
- ✓ Database is created automatically if missing

---

**Total changes**: 3 locations, ~10 lines of code  
**Risk**: ZERO (isolated, non-blocking)  
**Testing time**: 5 minutes
