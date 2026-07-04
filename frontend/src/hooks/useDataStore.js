import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const initialState = {
  transactions: [],
  cases: [],
  reports: {},
  stats: {
    statements_uploaded: 0,
    investigations_created: 0,
    high_risk_investigations: 0,
    high_risk_transactions: 0,
    total_volume: 0
  },
  loading: false,
  error: null
};

let store = { ...initialState };
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => listener({ ...store }));
};

const setStore = (updater) => {
  store = typeof updater === 'function' ? { ...store, ...updater(store) } : { ...store, ...updater };
  notify();
};

// API Helpers
export const uploadStatement = async (file) => {
  setStore({ loading: true, error: null });
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }
    const data = await res.json();
    setStore({ loading: false });
    // Refresh stats and cases
    await fetchStats();
    await fetchInvestigations();
    return data;
  } catch (err) {
    setStore({ loading: false, error: err.message });
    throw err;
  }
};

export const fetchInvestigations = async () => {
  try {
    const res = await fetch(`${API_BASE}/investigations`);
    if (!res.ok) throw new Error('Failed to fetch investigations');
    const data = await res.json();
    setStore({ cases: data });
    return data;
  } catch (err) {
    console.error(err);
  }
};

export const fetchInvestigation = async (caseId) => {
  try {
    const res = await fetch(`${API_BASE}/investigation/${caseId}`);
    if (!res.ok) throw new Error(`Failed to fetch details for case ${caseId}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const fetchReport = async (caseId) => {
  try {
    const res = await fetch(`${API_BASE}/investigation/${caseId}/report`);
    if (!res.ok) throw new Error(`Failed to fetch report for case ${caseId}`);
    const data = await res.json();
    setStore((prev) => ({
      reports: {
        ...prev.reports,
        [caseId]: data
      }
    }));
    return data;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const fetchStats = async () => {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    setStore({ stats: data });
    return data;
  } catch (err) {
    console.error(err);
  }
};

export const searchEntities = async (query, type = 'all') => {
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&type=${type}`);
    if (!res.ok) throw new Error('Search failed');
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const seedDemo = async () => {
  setStore({ loading: true });
  try {
    const res = await fetch(`${API_BASE}/seed-demo`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to seed data');
    const data = await res.json();
    setStore({ loading: false });
    await fetchStats();
    await fetchInvestigations();
    return data;
  } catch (err) {
    setStore({ loading: false, error: err.message });
    throw err;
  }
};

export const fetchCrossStatementIntelligence = async () => {
  try {
    const res = await fetch(`${API_BASE}/cross-statement-intelligence`);
    if (!res.ok) throw new Error('Failed to fetch cross-statement intelligence');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const useDataStore = () => {
  const [state, setState] = useState(store);

  useEffect(() => {
    listeners.add(setState);
    // Initial fetch if empty
    if (store.cases.length === 0) {
      fetchInvestigations();
      fetchStats();
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
    uploadStatement,
    fetchInvestigations,
    fetchInvestigation,
    fetchReport,
    fetchStats,
    searchEntities,
    seedDemo,
    fetchCrossStatementIntelligence
  };
};
