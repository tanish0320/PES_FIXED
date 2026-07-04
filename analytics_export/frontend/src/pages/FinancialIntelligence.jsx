import { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, GitBranch, Search, Zap, Loader } from 'lucide-react';
import {
  fetchGlobalGraph,
  fetchCycles,
  fetchMoneyTrails,
  fetchTopMoneyHubs,
  fetchAccount,
  fetchEntity,
  fetchHighRiskNetwork
} from '../hooks/useFinancialIntelligenceStore';

export default function FinancialIntelligence() {
  const [activeTab, setActiveTab] = useState('cycles');
  const [loading, setLoading] = useState(false);
  const [cycles, setCycles] = useState(null);
  const [graph, setGraph] = useState(null);
  const [hubs, setHubs] = useState(null);
  const [trails, setTrails] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [error, setError] = useState(null);

  // Load cycles (flagship feature) on mount
  useEffect(() => {
    loadCycles();
  }, []);

  const loadCycles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCycles();
      setCycles(data);
    } catch (err) {
      setError(`Failed to load cycles: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGlobalGraph();
      setGraph(data);
    } catch (err) {
      setError(`Failed to load graph: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadHubs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTopMoneyHubs(15);
      setHubs(data);
    } catch (err) {
      setError(`Failed to load hubs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTrails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMoneyTrails();
      setTrails(data);
    } catch (err) {
      setError(`Failed to load money trails: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const accountData = await fetchAccount(searchValue).catch(() => null);
      const entityData = await fetchEntity(searchValue).catch(() => null);
      setSearchResults({
        query: searchValue,
        account: accountData,
        entity: entityData
      });
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    setSearchResults(null);

    if (tab === 'cycles' && !cycles) loadCycles();
    if (tab === 'graph' && !graph) loadGraph();
    if (tab === 'hubs' && !hubs) loadHubs();
    if (tab === 'trails' && !trails) loadTrails();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3 mb-2">
            <Zap className="text-amber-500" size={32} />
            Global Financial Intelligence
          </h1>
          <p className="text-slate-600">
            Cross-statement circular money traversal, money trails, and network analysis
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
            <div className="text-red-700">{error}</div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {[
            { id: 'cycles', label: 'Circular Money Traversal', icon: GitBranch },
            { id: 'graph', label: 'Global Graph', icon: TrendingUp },
            { id: 'trails', label: 'Money Trails', icon: Search },
            { id: 'hubs', label: 'Top Money Hubs', icon: Zap },
            { id: 'search', label: 'Cross-Statement Search', icon: Search }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center p-12">
            <Loader className="animate-spin text-blue-500 mr-3" size={24} />
            <span className="text-slate-600">Loading...</span>
          </div>
        )}

        {/* Tab Content */}
        {!loading && (
          <>
            {/* Circular Money Traversal */}
            {activeTab === 'cycles' && cycles && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Detected Cycles</h2>
                {cycles.cycle_count === 0 ? (
                  <p className="text-slate-600">No circular money flows detected.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-blue-600">{cycles.cycle_count}</div>
                        <div className="text-sm text-slate-600">Total Cycles</div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-red-600">{cycles.high_risk_cycles?.length || 0}</div>
                        <div className="text-sm text-slate-600">High-Risk (≥70%)</div>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-amber-600">${(cycles.total_volume_in_cycles / 1000000).toFixed(1)}M</div>
                        <div className="text-sm text-slate-600">Total Volume</div>
                      </div>
                    </div>

                    {cycles.cycles.map((cycle, idx) => (
                      <div
                        key={cycle.cycle_id}
                        className={`p-4 border-l-4 rounded ${
                          cycle.risk_score >= 70
                            ? 'border-red-500 bg-red-50'
                            : cycle.risk_score >= 50
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-blue-500 bg-blue-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-slate-900">{cycle.cycle_id}</h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            cycle.risk_score >= 70 ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'
                          }`}>
                            Risk: {cycle.risk_score.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-slate-700 mb-2">
                          <strong>Path:</strong> {cycle.accounts.join(' → ')}
                        </p>
                        <p className="text-slate-600 text-sm">
                          <strong>Hops:</strong> {cycle.steps} | <strong>Amount:</strong> ${(cycle.total_amount / 100000).toFixed(2)}L | <strong>Duration:</strong> {cycle.duration_days} days
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Global Graph */}
            {activeTab === 'graph' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Global Financial Graph</h2>
                {!graph ? (
                  <button
                    onClick={loadGraph}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Load Graph
                  </button>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-blue-600">{graph.node_count}</div>
                        <div className="text-sm text-slate-600">Total Nodes</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-green-600">{graph.edge_count}</div>
                        <div className="text-sm text-slate-600">Transactions</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-purple-600">{graph.account_count}</div>
                        <div className="text-sm text-slate-600">Accounts</div>
                      </div>
                    </div>
                    <div className="text-slate-600 text-sm">
                      <p className="mb-4">Graph contains {graph.node_count} connected entities across {graph.edge_count} transactions.</p>
                      <p className="text-xs text-slate-500">Note: Full graph visualization requires frontend integration. Refer to global-graph API for node/edge data.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Money Trails */}
            {activeTab === 'trails' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">FIFO Money Trails</h2>
                {!trails ? (
                  <button
                    onClick={loadTrails}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Load Money Trails
                  </button>
                ) : (
                  <div>
                    <p className="text-slate-600 mb-4">
                      {trails.account_count === 0
                        ? 'No money trails detected.'
                        : `Found ${trails.account_count} accounts with money trails.`}
                    </p>
                    <div className="text-xs text-slate-500">
                      <p className="mb-2">Money trails use FIFO (First-In-First-Out) allocation to trace credit flows through accounts.</p>
                      <p>Refer to money-trails API for detailed allocation per account.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top Money Hubs */}
            {activeTab === 'hubs' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Top Money Hubs</h2>
                {!hubs ? (
                  <button
                    onClick={loadHubs}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Load Money Hubs
                  </button>
                ) : (
                  <div>
                    {hubs.count === 0 ? (
                      <p className="text-slate-600">No money hubs found.</p>
                    ) : (
                      <div className="space-y-2">
                        {hubs.hubs.map((hub, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="font-medium text-slate-900">#{idx + 1} {hub.account_id}</span>
                            <span className="text-blue-600 font-bold">${(hub.total_volume / 1000000).toFixed(2)}M</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cross-Statement Search */}
            {activeTab === 'search' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Cross-Statement Search</h2>
                <form onSubmit={handleSearch} className="mb-6">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search account ID, UPI ID, merchant, IFSC, etc."
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Search
                    </button>
                  </div>
                </form>

                {searchResults && (
                  <div className="space-y-6">
                    {searchResults.account && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-bold text-slate-900 mb-2">Account</h3>
                        <p className="text-slate-700 mb-2"><strong>ID:</strong> {searchResults.account.account?.account_id}</p>
                        <p className="text-slate-700 mb-2"><strong>Bank:</strong> {searchResults.account.account?.bank_name || 'Unknown'}</p>
                        <p className="text-slate-700 mb-2"><strong>Transactions:</strong> {searchResults.account.transaction_count}</p>
                        <p className="text-slate-700"><strong>Net Flow:</strong> ${(searchResults.account.net_flow / 100000).toFixed(2)}L</p>
                      </div>
                    )}
                    {searchResults.entity && (
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h3 className="font-bold text-slate-900 mb-2">Entities Found</h3>
                        <p className="text-slate-700 mb-2"><strong>Matches:</strong> {searchResults.entity.count}</p>
                        <div className="text-sm text-slate-600">
                          {searchResults.entity.matches.slice(0, 5).map((m, i) => (
                            <div key={i}>{m.value} ({m.type})</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!searchResults.account && !searchResults.entity && (
                      <p className="text-slate-600">No results found for "{searchResults.query}"</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
