import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Activity, ShieldAlert, BarChart3, TrendingUp, 
  UploadCloud, AlertOctagon, Layers, Search, RefreshCw, X
} from 'lucide-react';
import { useDataStore } from '../hooks/useDataStore';
import { useCopilot } from '../components/CopilotContext';
import { 
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, 
  Tooltip, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import CaseCard from '../components/CaseCard';
import { 
  CategoryDrilldownDrawer, 
  TransactionDrilldownDrawer 
} from '../components/InvestigationDrawers';

const RISK_COLORS = {
  'CRITICAL': '#ef4444',
  'HIGH': '#f97316',
  'MEDIUM': '#f59e0b',
  'LOW': '#10b981'
};

const CHANNEL_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, cases, loading, fetchStats, fetchInvestigations, fetchInvestigation } = useDataStore();

  const { registerToolHandler } = useCopilot();

  const [globalSearch, setGlobalSearch] = useState('');
  
  // Detailed case details for drilldown computation
  const [allCaseDetails, setAllCaseDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Drilldown states
  const [drilldownCategory, setDrilldownCategory] = useState(null);
  const [drilldownTxs, setDrilldownTxs] = useState([]);
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchInvestigations();
  }, []);

  useEffect(() => {
    registerToolHandler('getDashboardStats', () => stats);
  }, [stats, registerToolHandler]);

  // Fetch detailed information for all cases when loaded
  useEffect(() => {
    async function loadAllDetails() {
      if (cases && cases.length > 0) {
        setLoadingDetails(true);
        try {
          const details = await Promise.all(
            cases.map(c => fetchInvestigation(c.case_id))
          );
          setAllCaseDetails(details);
        } catch (err) {
          console.error("Failed to load details for all cases:", err);
        } finally {
          setLoadingDetails(false);
        }
      }
    }
    loadAllDetails();
  }, [cases]);

  // Aggregate all transactions from all cases
  const allTransactions = useMemo(() => {
    return allCaseDetails.flatMap(d => d.transactions || []);
  }, [allCaseDetails]);

  const formatINR = (value) => {
    if (value === undefined || value === null) return '₹0';
    try {
      const num = parseInt(value);
      const s = String(num);
      if (s.length <= 3) return `₹${s}`;
      const lastThree = s.substring(s.length - 3);
      let remaining = s.substring(0, s.length - 3);
      const groups = [];
      while (remaining.length > 0) {
        groups.push(remaining.substring(Math.max(0, remaining.length - 2)));
        remaining = remaining.substring(0, Math.max(0, remaining.length - 2));
      }
      groups.reverse();
      return `₹${groups.join(',')},${lastThree}`;
    } catch {
      return `₹${Number(value).toLocaleString('en-IN')}`;
    }
  };

  // 1. Risk distribution data
  const riskData = useMemo(() => {
    if (!stats?.risk_distribution) return [];
    return Object.entries(stats.risk_distribution).map(([name, count]) => ({
      name,
      count
    }));
  }, [stats]);

  // 2. Channel distribution data
  const channelData = useMemo(() => {
    if (!stats?.channel_distribution) return [];
    return Object.entries(stats.channel_distribution).map(([name, value]) => ({
      name,
      value
    }));
  }, [stats]);

  // 3. Pattern distribution data
  const patternData = useMemo(() => {
    if (!stats?.pattern_distribution) return [];
    return Object.entries(stats.pattern_distribution).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);
  }, [stats]);

  // 4. Timeline activity data
  const timelineData = useMemo(() => {
    return stats?.timeline_activity || [];
  }, [stats]);

  // Filter cases based on global search
  const filteredCases = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    if (!q) return cases;
    return cases.filter(c => 
      String(c.case_id).toLowerCase().includes(q) ||
      String(c.account_id).toLowerCase().includes(q) ||
      String(c.risk_level).toLowerCase().includes(q) ||
      c.patterns_detected?.some(p => p.toLowerCase().includes(q))
    );
  }, [cases, globalSearch]);

  // Drilldown card triggers
  const handleKpiClick = (label) => {
    if (loadingDetails) return;
    setDrilldownCategory(label);
    
    if (label === 'Critical / High Cases') {
      const filtered = allCaseDetails
        .filter(d => {
          const l = String(d.case?.risk_level).toUpperCase();
          return l === 'CRITICAL' || l === 'HIGH';
        })
        .flatMap(d => d.transactions || []);
      setDrilldownTxs(filtered);
    } else if (label === 'Flagged Transactions') {
      const filtered = allTransactions.filter(t => t.risk_score >= 60 || t.amount >= 50000);
      setDrilldownTxs(filtered);
    } else {
      setDrilldownTxs(allTransactions);
    }
  };

  const handleChartClick = (type, data) => {
    if (loadingDetails || !data) return;
    
    if (type === 'channel') {
      const channel = String(data.name).toUpperCase();
      setDrilldownCategory(`Channel: ${channel}`);
      setDrilldownTxs(allTransactions.filter(t => String(t.channel || '').toUpperCase() === channel));
    } else if (type === 'risk') {
      const level = String(data.name).toUpperCase();
      setDrilldownCategory(`Risk Profile: ${level}`);
      const filtered = allCaseDetails
        .filter(d => String(d.case?.risk_level).toUpperCase() === level)
        .flatMap(d => d.transactions || []);
      setDrilldownTxs(filtered);
    } else if (type === 'pattern') {
      const patternName = data.name;
      setDrilldownCategory(`Pattern: ${patternName}`);
      const filtered = allCaseDetails
        .filter(d => d.case?.patterns_detected?.includes(patternName))
        .flatMap(d => d.transactions || []);
      setDrilldownTxs(filtered);
    } else if (type === 'timeline') {
      const dateStr = data.date;
      setDrilldownCategory(`Date: ${dateStr}`);
      setDrilldownTxs(allTransactions.filter(t => String(t.date || '').startsWith(dateStr)));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-slate-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-xs font-semibold">Loading Workstation Forensics Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-slate-100 space-y-10 relative">
      
      {/* Search everywhere bar (Feature 10) */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search size={16} />
        </span>
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Global workstation search (Case IDs, account numbers, risk status, anomaly patterns)..."
          className="w-full bg-slate-900 border border-slate-850 py-3.5 pl-11 pr-4 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition-all placeholder-slate-600 font-bold shadow-lg"
        />
      </div>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
            Workstation Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Financial Intelligence Unit (FIU) Forensic Analysis Center
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { fetchStats(); fetchInvestigations(); }}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
            title="Refresh Dashboard Data"
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={() => navigate('/upload')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-lg text-sm shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2"
          >
            <UploadCloud size={16} />
            Upload Statements
          </button>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Statements Processed', value: stats?.statements_uploaded || 0, icon: FileText, color: 'text-indigo-400' },
          { label: 'Investigations Opened', value: stats?.investigations_created || 0, icon: Activity, color: 'text-blue-400' },
          { label: 'Critical / High Cases', value: stats?.high_risk_investigations || 0, icon: AlertOctagon, color: 'text-red-400' },
          { label: 'Flagged Transactions', value: stats?.high_risk_transactions || 0, icon: ShieldAlert, color: 'text-amber-400' },
          { label: 'Total Volume Scanned', value: formatINR(stats?.total_volume), icon: TrendingUp, color: 'text-emerald-400', isLarge: true }
        ].map((kpi, i) => (
          <div 
            key={i} 
            onClick={() => handleKpiClick(kpi.label)}
            className={`bg-slate-900 hover:border-indigo-500/50 border border-slate-850 p-5 rounded-xl flex flex-col justify-between shadow-lg relative overflow-hidden cursor-pointer transition-all ${
              kpi.isLarge ? 'col-span-2 md:col-span-1' : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider leading-snug">
                {kpi.label}
              </span>
              <kpi.icon size={16} className={`${kpi.color} opacity-80`} />
            </div>
            <p className="text-xl font-black text-white mt-4 tracking-tight">{kpi.value}</p>
            <span className="text-[8px] text-slate-600 block mt-2 font-bold uppercase tracking-wider">Click to drill down</span>
          </div>
        ))}
      </section>

      {/* Chart Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Timeline Chart */}
        <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl">
          <h3 className="text-xs font-black uppercase tracking-wider mb-6 text-slate-400 flex items-center gap-2">
            <TrendingUp size={14} className="text-indigo-400" /> Scanning Volume History (Interactive)
          </h3>
          <div className="h-[280px] w-full">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={timelineData}
                  onClick={(e) => e && e.activePayload && handleChartClick('timeline', e.activePayload[0].payload)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '10px', color: '#f1f5f9' }}
                    labelStyle={{ fontSize: '10px', color: '#64748b' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="volume" 
                    stroke="#4f46e5" 
                    strokeWidth={3} 
                    dot={{ fill: '#4f46e5', r: 3 }} 
                    activeDot={{ r: 6 }}
                    className="cursor-pointer"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-600 italic">
                No activity records available.
              </div>
            )}
          </div>
        </div>

        {/* Risk Distribution Chart */}
        <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl">
          <h3 className="text-xs font-black uppercase tracking-wider mb-6 text-slate-400 flex items-center gap-2">
            <BarChart3 size={14} className="text-indigo-400" /> Case Risk Profile Distribution (Interactive)
          </h3>
          <div className="h-[280px] w-full">
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={riskData}
                  onClick={(e) => e && e.activePayload && handleChartClick('risk', e.activePayload[0].payload)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32} className="cursor-pointer">
                    {riskData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={RISK_COLORS[entry.name] || '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-600 italic">
                No case risk metrics available.
              </div>
            )}
          </div>
        </div>

        {/* Channel Pie Chart */}
        <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl">
          <h3 className="text-xs font-black uppercase tracking-wider mb-6 text-slate-400 flex items-center gap-2">
            <Layers size={14} className="text-indigo-400" /> Transaction Channel Distribution (Interactive)
          </h3>
          <div className="h-[280px] w-full">
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    className="cursor-pointer"
                    onClick={(data) => handleChartClick('channel', data)}
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-[10px] text-slate-400 font-bold uppercase">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-600 italic">
                No transaction channels recorded.
              </div>
            )}
          </div>
        </div>

        {/* Pattern Prevalence Chart */}
        <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl">
          <h3 className="text-xs font-black uppercase tracking-wider mb-6 text-slate-400 flex items-center gap-2">
            <ShieldAlert size={14} className="text-indigo-400" /> Most Common Anomaly Triggers (Interactive)
          </h3>
          <div className="h-[280px] w-full">
            {patternData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={patternData} 
                  layout="vertical"
                  onClick={(e) => e && e.activePayload && handleChartClick('pattern', e.activePayload[0].payload)}
                >
                  <XAxis type="number" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={8} width={120} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-600 italic">
                No pattern triggers identified yet.
              </div>
            )}
          </div>
        </div>

      </section>

      {/* Grid of Top/Recent Investigations */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Active Case Investigations
          </h2>
          {filteredCases.length > 0 && (
            <button 
              onClick={() => navigate('/investigations')}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              See all ({filteredCases.length})
            </button>
          )}
        </div>
        
        {filteredCases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredCases.slice(0, 6).map((c) => (
              <CaseCard 
                key={c.case_id} 
                caseData={c} 
                onAnalyze={(cData) => navigate(`/graph/${cData.case_id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[280px] border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
            <span className="text-3xl mb-3">📂</span>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">No active cases match search</h4>
            <p className="text-xs text-slate-600 mt-1">Try another search term or upload a statement.</p>
          </div>
        )}
      </section>

      {/* Category Drilldown Table Drawer */}
      {drilldownCategory && (
        <CategoryDrilldownDrawer
          category={drilldownCategory}
          transactions={drilldownTxs}
          onClose={() => { setDrilldownCategory(null); setDrilldownTxs([]); }}
          onTxSelect={(tx) => setSelectedTx(tx)}
        />
      )}

      {/* Transaction Detailed Drilldown Drawer */}
      {selectedTx && (
        <TransactionDrilldownDrawer
          transaction={selectedTx}
          allTransactions={allTransactions}
          onClose={() => setSelectedTx(null)}
          onHighlightOnGraph={() => {
            // Redirect to graph page with target parameters
            sessionStorage.setItem('highlight_txs', JSON.stringify([selectedTx.tx_id]));
            sessionStorage.setItem('highlight_nodes', JSON.stringify([selectedTx.sender_account, selectedTx.receiver_account].filter(id => id && id !== 'external')));
            navigate(`/graph/${selectedTx.case_id}`);
          }}
        />
      )}

    </div>
  );
}
