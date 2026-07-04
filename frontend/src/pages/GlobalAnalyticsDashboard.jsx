import { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, Activity, AlertTriangle, Loader } from 'lucide-react';
import { fetchGlobalAnalytics } from '../hooks/useFinancialIntelligenceStore';

export default function GlobalAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGlobalAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(`Failed to load analytics: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="animate-spin text-blue-500 mr-3" size={24} />
        <span className="text-slate-600">Loading global analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertCircle className="text-red-600 mr-3 flex-shrink-0 mt-1" size={20} />
          <div>
            <h3 className="font-bold text-red-900">Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const { summary, cycles, top_money_hubs, high_risk_accounts } = analytics;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">Total Transactions</p>
              <p className="text-3xl font-bold text-slate-900">{summary.total_transactions.toLocaleString()}</p>
            </div>
            <Activity className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">Total Accounts</p>
              <p className="text-3xl font-bold text-slate-900">{summary.total_accounts}</p>
            </div>
            <TrendingUp className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">Total Volume</p>
              <p className="text-2xl font-bold text-slate-900">₹{(summary.total_volume / 1000000000).toFixed(0)}B</p>
            </div>
            <TrendingUp className="text-purple-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">Cycles Detected</p>
              <p className="text-3xl font-bold text-slate-900">{cycles.total_cycles}</p>
            </div>
            <AlertTriangle className="text-red-500" size={32} />
          </div>
        </div>
      </div>

      {/* Cycles Breakdown */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Circular Money Flows</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-slate-600 text-sm">High-Risk Cycles (≥70%)</p>
            <p className="text-3xl font-bold text-red-600">{cycles.high_risk_cycles}</p>
            <p className="text-xs text-slate-500 mt-2">Immediate attention needed</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg">
            <p className="text-slate-600 text-sm">Medium-Risk Cycles (50-69%)</p>
            <p className="text-3xl font-bold text-amber-600">{cycles.medium_risk_cycles}</p>
            <p className="text-xs text-slate-500 mt-2">Monitor closely</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-slate-600 text-sm">Low-Risk Cycles (&lt;50%)</p>
            <p className="text-3xl font-bold text-blue-600">{cycles.low_risk_cycles}</p>
            <p className="text-xs text-slate-500 mt-2">Standard review</p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <p className="text-slate-600">
            <strong>Total Volume in Cycles:</strong> ₹{(cycles.total_volume_in_cycles / 1000000).toFixed(1)}M
          </p>
        </div>
      </div>

      {/* Top Money Hubs */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Top Money Hubs</h2>
        <div className="space-y-3">
          {top_money_hubs.map((hub) => (
            <div key={hub.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-blue-50">
              <div>
                <p className="font-bold text-slate-900">{hub.label}</p>
                <p className="text-sm text-slate-600">{hub.transaction_count.toLocaleString()} transactions</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">₹{(hub.volume / 1000000000).toFixed(1)}B</p>
                <p className={`text-sm font-semibold ${
                  hub.risk_score >= 70 ? 'text-red-600' :
                  hub.risk_score >= 50 ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                  Risk: {hub.risk_score}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* High-Risk Accounts */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">High-Risk Accounts</h2>
        <div className="space-y-3">
          {high_risk_accounts.map((account) => (
            <div key={account.id} className="p-4 border-l-4 border-red-500 bg-red-50 rounded">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900">{account.label}</p>
                  <p className="text-sm text-slate-600 mt-1">{account.reason}</p>
                </div>
                <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {account.risk_score}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
