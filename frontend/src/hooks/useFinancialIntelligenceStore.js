// Static data - no API calls
const GRAPH_DATA = {
  node_count: 92,
  edge_count: 48614,
  account_count: 92,
  total_volume: 511048418702.0,
  nodes: [{id: "ACC001", label: "Top Account 1", type: "account", volume: 509961160087.95}],
  edges: [{source: "ACC001", target: "ACC002", amount: 100000000}]
};

const CYCLES_DATA = {
  cycles: [{
    cycle_id: "cycle_0",
    accounts: ["ACC001", "ACC002", "ACC003", "ACC001"],
    transaction_ids: ["TXN1", "TXN2", "TXN3"],
    total_amount: 100000.0,
    steps: 4,
    risk_score: 75,
    duration_days: 5
  }],
  cycle_count: 1,
  high_risk_cycles: [{cycle_id: "cycle_0", risk_score: 75}],
  total_volume_in_cycles: 100000.0
};

const HUBS_DATA = {
  hubs: [
    {account_id: "ACC001", total_volume: 509961160087.95},
    {account_id: "ACC002", total_volume: 509814701588.0},
    {account_id: "ACC003", total_volume: 492281088.17}
  ]
};

const TRAILS_DATA = {
  account_count: 58,
  accounts: {
    ACC001: {
      trails: [{source_tx: "TXN1", current_tx: "TXN2", allocated_amount: 100000}],
      total_inflow: 500000,
      total_outflow: 450000,
      balance_now: 50000
    }
  }
};

export const fetchGlobalGraph = () => Promise.resolve(GRAPH_DATA);
export const fetchCycles = () => Promise.resolve(CYCLES_DATA);
export const fetchMoneyTrails = (accountId) => Promise.resolve(TRAILS_DATA);
export const fetchTopMoneyHubs = (limit = 10) => Promise.resolve(HUBS_DATA);
export const fetchAccount = (id) => Promise.resolve({
  account: {account_id: id, holder_name: "Sample", bank_name: "Bank"},
  transactions: [],
  transaction_count: 0,
  inflow: 0,
  outflow: 0,
  net_flow: 0
});
export const fetchEntity = (value) => Promise.resolve({value, matches: [], count: 0});
export const fetchHighRiskNetwork = () => Promise.resolve({high_risk_cycles: [], involved_accounts: [], count: 0, total_volume: 0});
