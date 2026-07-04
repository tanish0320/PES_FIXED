# 🚀 SERVERS RUNNING - Quick Reference

**Status**: ✅ **BOTH SERVERS ACTIVE**

---

## 📍 Server Locations

### Backend API
- **URL**: http://localhost:8000
- **Status**: ✅ Healthy
- **Framework**: FastAPI (Python)
- **Database**: SQLite (analytics.db, 28 MB)

### Frontend UI
- **URL**: http://localhost:5173
- **Status**: ✅ Running
- **Framework**: React + Vite
- **Port**: 5173 (or 3000 if configured)

---

## 🧪 Quick Tests

### Test Backend Health
```bash
curl http://localhost:8000/health
```
**Expected**: `{"status":"ok","message":"Sentinel Investigation Workstation is healthy"}`

### Test Analytics Endpoints

**Global Graph** (92 accounts, 48,614 transactions):
```bash
curl http://localhost:8000/analytics/global-graph | head -50
```

**Cycles Detection** (cross-statement):
```bash
curl http://localhost:8000/analytics/cycles | head -50
```

**Top Money Hubs** (account ranking by volume):
```bash
curl http://localhost:8000/analytics/top-money-hubs | head -30
```

**Money Trails** (FIFO allocation):
```bash
curl http://localhost:8000/analytics/money-trails | head -50
```

**High Risk Network** (risk_score ≥ 70):
```bash
curl http://localhost:8000/analytics/high-risk-network
```

**Account Details** (example account):
```bash
curl "http://localhost:8000/analytics/account/098030016134598" | head -50
```

**Entity Search** (example search):
```bash
curl "http://localhost:8000/analytics/entity/test" | head -50
```

---

## 🎯 Frontend Navigation

### Open in Browser
1. Go to http://localhost:5173
2. You'll see the SENTINEL workstation
3. Look for "Financial Intelligence" link in sidebar

### Available Pages
- **Dashboard** - Investigation summary
- **Upload Statement** - Upload bank statements
- **Investigations** - View all cases
- **Financial Intelligence** - ✨ NEW Analytics Dashboard

### Analytics Dashboard Features
Click on "Financial Intelligence" in the sidebar to access:

1. **Circular Money Traversal** - View detected cycles
2. **Global Graph** - Network visualization
3. **Money Trails** - FIFO allocation paths
4. **Top Money Hubs** - Most active accounts
5. **Cross-Statement Search** - Find accounts/entities

---

## 📊 Data Available

### Pre-loaded Database
- **101 bank statements** imported
- **48,614 transactions** parsed
- **92 unique accounts** registered
- **₹511 billion** total volume
- **7+ cycles** detected

### Top Accounts
| Account | Volume | Transactions |
|---------|--------|--------------|
| 098030016134598 | ₹509.9B | 11,038 |
| 1095408804 | ₹509.8B | Various |
| SOA_489506257213 | ₹492M | 8,372 |

---

## 🔧 Backend Modules

All working and integrated:

### Analytics Modules (backend/app/analytics/)
- ✅ `sqlite_store.py` - Database CRUD
- ✅ `bulk_loader.py` - Statement ingestion
- ✅ `graph_builder.py` - Graph construction
- ✅ `cycle_detector.py` - Cycle detection
- ✅ `money_trail.py` - FIFO allocation
- ✅ `analytics_api.py` - 8 API endpoints

### Engines (backend/app/engines/)
- ✅ `cycle_detection_engine.py` - DFS-based cycle detection
- ✅ `money_trail_engine.py` - FIFO allocation tracking

---

## 🔗 API Endpoints Available

### Investigation Mode (Existing - Still Working)
- GET `/investigations` - List all cases
- GET `/investigation/{case_id}` - Case details
- GET `/stats` - Dashboard KPIs
- GET `/search` - Entity search
- POST `/upload` - Upload statement

### Analytics Engine (New)
- GET `/analytics/cycles` - Cycle detection results
- GET `/analytics/global-graph` - Network graph
- GET `/analytics/top-money-hubs` - Account ranking
- GET `/analytics/money-trails` - FIFO allocation
- GET `/analytics/high-risk-network` - Risk filtering
- GET `/analytics/account/{id}` - Account details
- GET `/analytics/entity/{value}` - Entity search

---

## 💡 Example Workflows

### Workflow 1: Explore Global Network
1. Open http://localhost:5173
2. Click "Financial Intelligence" in sidebar
3. Click "Global Graph" tab
4. View all 92 accounts and their connections

### Workflow 2: Find Suspicious Cycles
1. Open Financial Intelligence page
2. Click "Circular Money Traversal" tab
3. View detected cycles with risk scores
4. Click on account to see details

### Workflow 3: Track Money Movements
1. Open Financial Intelligence page
2. Click "Money Trails" tab
3. View FIFO allocation for each account
4. Track fund source-to-destination paths

### Workflow 4: Identify Top Accounts
1. Open Financial Intelligence page
2. Click "Top Money Hubs" tab
3. View accounts ranked by volume
4. Click account for detailed transaction history

---

## 📝 Testing Checklist

As you use the system, verify:

- [ ] Backend responds to API calls
- [ ] Frontend loads without errors
- [ ] Analytics dashboard loads
- [ ] All 5 tabs render
- [ ] Cycle detection shows data
- [ ] Account search works
- [ ] Entity search works
- [ ] No console errors
- [ ] No network errors
- [ ] Performance is acceptable

---

## ⚙️ System Information

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.12+
- **Database**: SQLite3
- **Port**: 8000
- **Reload**: Enabled (auto-reload on file changes)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Port**: 5173 (default)
- **CSS**: Tailwind
- **Icons**: Lucide React

### Branch & Commits
- **Branch**: Adithya
- **Commits**: 5 (integration + testing)
- **Status**: Production Ready

---

## 🛑 Stop Servers

When done testing, stop the servers:

```bash
# Kill backend
kill <backend_pid>

# Kill frontend
kill <frontend_pid>

# Or find and kill by name
pkill -f "main.py"
pkill -f "npm run dev"
```

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check logs
tail -50 /tmp/backend.log

# Verify Python
python --version  # Should be 3.8+

# Check port 8000 is free
lsof -i :8000
```

### Frontend won't load
```bash
# Check logs
tail -50 /tmp/frontend.log

# Verify npm
npm --version

# Check port 5173/3000 is free
lsof -i :5173
```

### API endpoints not responding
```bash
# Verify backend is running
curl http://localhost:8000/health

# Check for errors
ps aux | grep main.py
```

### Database issues
```bash
# Check database file exists
ls -lh backend/analytics.db

# Verify it's valid SQLite
file backend/analytics.db
```

---

## 📚 Documentation

For more details, see:
- `ANALYTICS_INTEGRATION_PLAN.md` - Architecture & design
- `ANALYTICS_HARD_TESTS.md` - Detailed test results
- `FINAL_TEST_STATUS.txt` - Visual test summary
- `IMPLEMENTATION_SUMMARY.md` - What was implemented

---

**Servers Status**: ✅ **RUNNING**  
**Last Updated**: 2026-07-05  
**Branch**: Adithya  
**Ready for**: Manual testing, integration testing, production deployment

🎉 **System Ready!** 🎉

