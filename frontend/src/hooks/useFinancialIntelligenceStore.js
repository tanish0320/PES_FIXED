const API_BASE = import.meta.env.VITE_API_URL || '';

// Fetch global analytics summary (cycles, hubs, risk accounts)
export const fetchGlobalAnalytics = () =>
  fetch(`${API_BASE}/analytics/global-analytics`).then(r => r.json());

// Fetch global graph (uses nodes from analytics)
export const fetchGlobalGraph = () =>
  fetch(`${API_BASE}/analytics/global-graph`).then(r => r.json());

// Legacy endpoints
export const fetchCycles = () =>
  fetchGlobalAnalytics().then(data => ({
    cycles: data.cycles || [],
    cycle_count: data.cycles?.total_cycles || 0,
    high_risk_cycles: data.cycles?.high_risk_cycles || [],
    total_volume_in_cycles: data.cycles?.total_volume_in_cycles || 0
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
  fetchGlobalAnalytics().then(data => ({
    hubs: data.top_money_hubs || []
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
