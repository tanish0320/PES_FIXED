import React, { useState } from 'react';
import { Search, Zap, Activity, TrendingUp, X } from 'lucide-react';

/**
 * Graph Control Panel
 * Provides UI for: Search, Circular Flow Highlight, Money Trail, and Graph Styling
 */
export default function GraphControlPanel({
  onSearch,
  onHighlightCircularFlow,
  onTraceMoneyTrail,
  onClearHighlight,
  hasCircularFlows,
  selectedNode,
  circularFlowInfo
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCircularInfo, setShowCircularInfo] = useState(false);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    onClearHighlight?.('search');
  };

  return (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search account, UPI, merchant..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title="Search"
          >
            <Search size={20} />
          </button>
        </div>
      </div>

      {/* Feature Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Circular Flow Highlight */}
        <button
          onClick={() => {
            onHighlightCircularFlow();
            setShowCircularInfo(true);
          }}
          disabled={!hasCircularFlows}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
            hasCircularFlows
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
          title={hasCircularFlows ? 'Highlight circular money flows' : 'No circular flows detected'}
        >
          <Zap size={16} />
          <span className="text-sm">Circular Flow</span>
        </button>

        {/* Money Trail Trace */}
        <button
          onClick={() => onTraceMoneyTrail()}
          disabled={!selectedNode}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
            selectedNode
              ? 'bg-cyan-600 text-white hover:bg-cyan-700'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
          title={selectedNode ? 'Trace money trail from this account' : 'Select an account first'}
        >
          <Activity size={16} />
          <span className="text-sm">Trace Money</span>
        </button>

        {/* Reset Button */}
        <button
          onClick={() => {
            onClearHighlight?.('all');
            handleClearSearch();
            setShowCircularInfo(false);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all col-span-2"
        >
          <X size={16} />
          <span className="text-sm">Clear Highlights</span>
        </button>
      </div>

      {/* Circular Flow Info Panel */}
      {showCircularInfo && circularFlowInfo && (
        <div className="bg-slate-800 border border-red-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-red-400 flex items-center gap-2">
              <Zap size={16} />
              Circular Flow Detected
            </h3>
            <button
              onClick={() => setShowCircularInfo(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <p className="text-slate-400">Accounts Involved</p>
              <p className="text-slate-200 font-mono">
                {circularFlowInfo.accounts?.join(' → ')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-slate-400 text-xs">Total Amount</p>
                <p className="text-green-400 font-bold">
                  ₹{(circularFlowInfo.totalAmount / 1e6).toFixed(2)}M
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Hops</p>
                <p className="text-blue-400 font-bold">{circularFlowInfo.hopCount}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-slate-400 text-xs">Duration</p>
                <p className="text-slate-300">{circularFlowInfo.duration} days</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Confidence</p>
                <p className="text-slate-300">{circularFlowInfo.confidence}%</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
