import { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, GitBranch, Search, Zap, Loader, Globe, Filter } from 'lucide-react';
import {
  fetchGlobalGraph,
  fetchCycles,
  fetchMoneyTrails,
  fetchTopMoneyHubs,
  fetchAccount,
  fetchEntity,
  fetchHighRiskNetwork,
  fetchGlobalAnalytics
} from '../hooks/useFinancialIntelligenceStore';
import GlobalAnalyticsDashboard from './GlobalAnalyticsDashboard';

export default function FinancialIntelligence() {
  const [mode, setMode] = useState('global'); // 'global' or 'case'
  const [activeTab, setActiveTab] = useState('cycles');
  const [loading, setLoading] = useState(false);
  const [cycles, setCycles] = useState(null);
  const [graph, setGraph] = useState(null);
  const [hubs, setHubs] = useState(null);
  const [trails, setTrails] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(null);

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
    if (tab === 'hubs' && !hubs) loadHubs();
    if (tab === 'trails' && !trails) loadTrails();
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setError(null);
    setSearchResults(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3 mb-2">
            <Zap className="text-amber-500" size={32} />
            Financial Intelligence
          </h1>
          <p className="text-slate-600">
            {mode === 'global'
              ? 'Cross-statement circular money traversal, money trails, and network analysis'
              : 'Case-specific financial analysis and investigation insights'
            }
          </p>

          {/* Mode Toggle */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleModeChange('global')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                mode === 'global'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Globe size={18} />
              Global Dataset
            </button>
            <button
              onClick={() => handleModeChange('case')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                mode === 'case'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Filter size={18} />
              Case Investigation
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
            <div className="text-red-700">{error}</div>
          </div>
        )}

        {/* Tab Navigation - Only show for global mode */}
        {mode === 'global' && (
          <div className="mb-6 flex gap-2 flex-wrap">
            {[
              { id: 'analytics', label: 'Global Analytics', icon: TrendingUp },
              { id: 'cycles', label: 'Circular Money Traversal', icon: GitBranch },
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
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center p-12">
            <Loader className="animate-spin text-blue-500 mr-3" size={24} />
            <span className="text-slate-600">Loading...</span>
          </div>
        )}

        {/* Tab Content */}
        {!loading && mode === 'global' && (
          <>
            {/* Global Analytics Dashboard */}
            {activeTab === 'analytics' && (
              <GlobalAnalyticsDashboard />
            )}

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
                        onClick={() => setSelectedCycle(cycle)}
                        className={`p-4 border-l-4 rounded cursor-pointer transition-all hover:shadow-md ${
                          cycle.risk_score >= 70
                            ? 'border-red-500 bg-red-50 hover:bg-red-100'
                            : cycle.risk_score >= 50
                            ? 'border-amber-500 bg-amber-50 hover:bg-amber-100'
                            : 'border-blue-500 bg-blue-50 hover:bg-blue-100'
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
                        <p className="text-xs text-slate-500 mt-2">Click to view cycle graph</p>
                      </div>
                    ))}
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

        {/* Case Investigation Mode */}
        {!loading && mode === 'case' && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <Filter size={48} className="mx-auto text-slate-400 mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Case Investigation Analysis</h2>
              <p className="text-slate-600 mb-6">
                Select a case from the Investigations tab to analyze case-specific financial patterns and insights.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <p className="text-slate-700 mb-4">
                  <strong>Case Investigation Mode Features:</strong>
                </p>
                <ul className="text-left max-w-md mx-auto space-y-2 text-slate-600">
                  <li>✓ Transaction history for selected case</li>
                  <li>✓ Case-specific entity relationships</li>
                  <li>✓ Account flow analysis</li>
                  <li>✓ Risk assessment for case</li>
                  <li>✓ Timeline and pattern detection</li>
                </ul>
              </div>
              <div className="space-x-4">
                <a
                  href="/investigations"
                  className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Go to Investigations
                </a>
                <button
                  onClick={() => handleModeChange('global')}
                  className="inline-block px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
                >
                  Back to Global Dataset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cycle Graph Modal */}
        {selectedCycle && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Round-Trip Pattern: {selectedCycle.cycle_id}</h2>
                    <p className="text-slate-600 mt-1">Circular Money Flow Visualization</p>
                  </div>
                  <button
                    onClick={() => setSelectedCycle(null)}
                    className="text-slate-500 hover:text-slate-700 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
                    <p className="text-slate-600 text-xs uppercase tracking-wide font-semibold">Risk Score</p>
                    <p className={`text-3xl font-bold mt-1 ${
                      selectedCycle.risk_score >= 70 ? 'text-red-600' :
                      selectedCycle.risk_score >= 50 ? 'text-amber-600' :
                      'text-blue-600'
                    }`}>{selectedCycle.risk_score.toFixed(0)}%</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-600">
                    <p className="text-slate-600 text-xs uppercase tracking-wide font-semibold">Total Amount</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      ₹{(selectedCycle.total_amount >= 1000000
                        ? (selectedCycle.total_amount / 1000000).toFixed(1) + 'M'
                        : (selectedCycle.total_amount / 1000).toFixed(1) + 'K')}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-600">
                    <p className="text-slate-600 text-xs uppercase tracking-wide font-semibold">Hops</p>
                    <p className="text-3xl font-bold text-purple-600 mt-1">{selectedCycle.steps}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-600">
                    <p className="text-slate-600 text-xs uppercase tracking-wide font-semibold">Duration</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">{selectedCycle.duration_days}d</p>
                  </div>
                </div>

                {/* SVG Graph Visualization */}
                <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Money Flow Path</h3>
                  <svg viewBox="0 0 900 500" className="w-full h-96">
                    <defs>
                      <marker id="arrowForward" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
                      </marker>
                      <marker id="arrowReturn" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill="#16a34a" />
                      </marker>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Main path visualization */}
                    {selectedCycle.accounts && selectedCycle.accounts.length > 0 && (() => {
                      const accounts = selectedCycle.accounts;
                      const nodeRadius = 35;
                      const spacing = 750 / Math.max(accounts.length - 1, 1);
                      const positions = accounts.map((_, i) => ({
                        x: 75 + i * spacing,
                        y: 250,
                        account: accounts[i]
                      }));

                      return (
                        <g>
                          {/* Connection lines - arrows between accounts */}
                          {positions.map((pos, idx) => {
                            const nextIdx = (idx + 1) % positions.length;
                            const nextPos = positions[nextIdx];
                            const isLastEdge = idx === positions.length - 1;

                            return (
                              <g key={`edge-${idx}`}>
                                {/* Line */}
                                <line
                                  x1={pos.x + nodeRadius}
                                  y1={pos.y}
                                  x2={nextPos.x - nodeRadius}
                                  y2={nextPos.y}
                                  stroke={isLastEdge ? '#16a34a' : '#3b82f6'}
                                  strokeWidth="3"
                                  markerEnd={isLastEdge ? "url(#arrowReturn)" : "url(#arrowForward)"}
                                />
                                {/* Amount label */}
                                <rect
                                  x={(pos.x + nextPos.x) / 2 - 40}
                                  y={pos.y - 30}
                                  width="80"
                                  height="28"
                                  fill={isLastEdge ? '#dcfce7' : '#dbeafe'}
                                  stroke={isLastEdge ? '#16a34a' : '#3b82f6'}
                                  strokeWidth="1"
                                  rx="4"
                                />
                                <text
                                  x={(pos.x + nextPos.x) / 2}
                                  y={pos.y - 10}
                                  textAnchor="middle"
                                  className="text-xs font-bold"
                                  fill={isLastEdge ? '#166534' : '#0c4a6e'}
                                >
                                  {selectedCycle.total_amount >= 1000000
                                    ? `₹${(selectedCycle.total_amount / 1000000).toFixed(1)}M`
                                    : `₹${(selectedCycle.total_amount / 1000).toFixed(1)}K`}
                                </text>
                              </g>
                            );
                          })}

                          {/* Account nodes */}
                          {positions.map((pos, idx) => (
                            <g key={`node-${idx}`} filter="url(#glow)">
                              <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={nodeRadius}
                                fill={
                                  idx === 0 ? '#fee2e2' :
                                  idx === positions.length - 1 ? '#dbeafe' :
                                  '#f3f4f6'
                                }
                                stroke={
                                  idx === 0 ? '#dc2626' :
                                  idx === positions.length - 1 ? '#3b82f6' :
                                  '#9ca3af'
                                }
                                strokeWidth="3"
                              />
                              <text
                                x={pos.x}
                                y={pos.y - 8}
                                textAnchor="middle"
                                className="text-xs font-bold"
                                fill="#1e293b"
                              >
                                {pos.account.substring(0, 8)}
                              </text>
                              <text
                                x={pos.x}
                                y={pos.y + 8}
                                textAnchor="middle"
                                className="text-xs"
                                fill="#64748b"
                              >
                                {idx === 0 ? 'Start' : idx === positions.length - 1 ? 'End' : `Hop ${idx}`}
                              </text>
                            </g>
                          ))}

                          {/* Legend */}
                          <g transform="translate(20, 420)">
                            <text x="0" y="0" className="text-sm font-bold" fill="#1e293b">Legend:</text>

                            <line x1="0" y1="20" x2="20" y2="20" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowForward)" />
                            <text x="30" y="24" className="text-xs" fill="#1e293b">Forward Flow</text>

                            <line x1="150" y1="20" x2="170" y2="20" stroke="#16a34a" strokeWidth="2" markerEnd="url(#arrowReturn)" />
                            <text x="180" y="24" className="text-xs" fill="#1e293b">Return Flow</text>

                            <circle cx="330" cy="20" r="6" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" />
                            <text x="345" y="24" className="text-xs" fill="#1e293b">Start Account</text>

                            <circle cx="520" cy="20" r="6" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
                            <text x="535" y="24" className="text-xs" fill="#1e293b">End Account</text>
                          </g>
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                {/* Account Path Details */}
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-3">Account Sequence</h3>
                  <div className="flex flex-wrap gap-2 items-center justify-start text-sm">
                    {selectedCycle.accounts && selectedCycle.accounts.map((acc, idx) => (
                      <span key={idx}>
                        <span className={`inline-block px-3 py-1 rounded-full font-mono text-xs font-bold ${
                          idx === 0 ? 'bg-red-100 text-red-900' :
                          idx === selectedCycle.accounts.length - 1 ? 'bg-blue-100 text-blue-900' :
                          'bg-slate-200 text-slate-900'
                        }`}>
                          {acc}
                        </span>
                        {idx < selectedCycle.accounts.length - 1 && <span className="mx-1 text-slate-400">→</span>}
                        {idx === selectedCycle.accounts.length - 1 && <span className="mx-1 text-slate-400">→</span>}
                      </span>
                    ))}
                    {selectedCycle.accounts && selectedCycle.accounts.length > 0 && (
                      <span className="inline-block px-3 py-1 rounded-full font-mono text-xs font-bold bg-red-100 text-red-900">
                        {selectedCycle.accounts[0]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setSelectedCycle(null)}
                  className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close Visualization
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
