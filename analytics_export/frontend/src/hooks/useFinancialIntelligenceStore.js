const API_BASE = import.meta.env.VITE_API_URL || '';

export const fetchGlobalGraph = () =>
  fetch(`${API_BASE}/analytics/global-graph`).then(r => r.json());

export const fetchCycles = () =>
  fetch(`${API_BASE}/analytics/cycles`).then(r => r.json());

export const fetchMoneyTrails = (accountId) =>
  fetch(`${API_BASE}/analytics/money-trails${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`).then(r => r.json());

export const fetchTopMoneyHubs = (limit = 10) =>
  fetch(`${API_BASE}/analytics/top-money-hubs?limit=${limit}`).then(r => r.json());

export const fetchAccount = (id) =>
  fetch(`${API_BASE}/analytics/account/${encodeURIComponent(id)}`).then(r => r.json());

export const fetchEntity = (value) =>
  fetch(`${API_BASE}/analytics/entity/${encodeURIComponent(value)}`).then(r => r.json());

export const fetchHighRiskNetwork = () =>
  fetch(`${API_BASE}/analytics/high-risk-network`).then(r => r.json());
