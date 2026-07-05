const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  fetch(`${API_BASE}/analytics/money-trails${accountId ? `?account_id=${accountId}` : ''}`).then(r => r.json());

export const fetchTopMoneyHubs = (limit = 10) =>
  fetch(`${API_BASE}/analytics/top-money-hubs?limit=${limit}`).then(r => r.json()).then(data => ({
    hubs: data.hubs || [],
    count: data.count || 0
  }));

export const fetchAccount = (id) =>
  fetch(`${API_BASE}/analytics/account/${id}`).then(r => r.json()).catch(() => ({
    account: {account_id: id, holder_name: "Unknown", bank_name: "Unknown"},
    transactions: [],
    transaction_count: 0,
    inflow: 0,
    outflow: 0,
    net_flow: 0
  }));

export const fetchEntity = (value) =>
  fetch(`${API_BASE}/analytics/entity/${value}`).then(r => r.json()).catch(() => ({value, matches: [], count: 0}));

export const fetchHighRiskNetwork = () =>
  fetchGlobalAnalytics().then(data => ({
    high_risk_cycles: data.high_risk_accounts || [],
    involved_accounts: (data.high_risk_accounts || []).map(a => a.id),
    count: (data.high_risk_accounts || []).length,
    total_volume: 0
  }));
