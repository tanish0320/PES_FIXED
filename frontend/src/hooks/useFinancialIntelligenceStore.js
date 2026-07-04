const API_BASE = import.meta.env.VITE_API_URL || '';

// Fetch global analytics summary (cycles, hubs, risk accounts)
export const fetchGlobalAnalytics = () =>
  fetch(`${API_BASE}/analytics/global-analytics`).then(r => r.json());

// Fetch global graph (uses nodes from analytics)
export const fetchGlobalGraph = () =>
  fetch(`${API_BASE}/analytics/global-graph`).then(r => r.json());

// Legacy endpoints
export const fetchCycles = () =>
  fetch(`${API_BASE}/analytics/cycles`).then(r => r.json()).then(data => ({
    cycles: data.cycles || [],
    cycle_count: data.cycles?.length || 0,
    high_risk_cycles: data.cycles?.filter(c => c.risk_score >= 70) || [],
    total_volume_in_cycles: (data.cycles || []).reduce((sum, c) => sum + (c.total_amount || 0), 0)
  }));

export const fetchMoneyTrails = (accountId) =>
  Promise.resolve({
    account_count: 58,
    accounts: {
      ACC001: {
        trails: [{source_tx: "TXN1", current_tx: "TXN2", allocated_amount: 100000}],
        total_inflow: 500000,
        total_outflow: 450000,
        balance_now: 50000
      }
    }
  });

export const fetchTopMoneyHubs = (limit = 10) =>
  fetch(`${API_BASE}/analytics/top-money-hubs?limit=${limit}`).then(r => r.json()).then(data => ({
    hubs: data.hubs || [],
    count: data.count || 0
  }));

export const fetchAccount = (id) =>
  Promise.resolve({
    account: {account_id: id, holder_name: "Sample", bank_name: "Bank"},
    transactions: [],
    transaction_count: 0,
    inflow: 0,
    outflow: 0,
    net_flow: 0
  });

export const fetchEntity = (value) =>
  Promise.resolve({value, matches: [], count: 0});

export const fetchHighRiskNetwork = () =>
  fetchGlobalAnalytics().then(data => ({
    high_risk_cycles: data.high_risk_accounts || [],
    involved_accounts: (data.high_risk_accounts || []).map(a => a.id),
    count: (data.high_risk_accounts || []).length,
    total_volume: 0
  }));
