import React, { useState, useEffect } from 'react';
import { useDataStore } from '../hooks/useDataStore';
import RiskBadge from '../components/RiskBadge';
import InvestigationSidebar from '../components/InvestigationSidebar';
import { getRole } from '../roleStore';
import { useCopilot } from '../components/CopilotContext';
import { Search, Filter, Calendar, CreditCard, ShieldAlert, ArrowRight, ArrowLeftRight } from 'lucide-react';

export default function Feed() {
  const { cases, fetchInvestigation } = useDataStore();
  const [selectedCaseId, setSelectedCaseId] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [channelFilter, setChannelFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sidebarState, setSidebarState] = useState({ isOpen: false, tx: null, case: null, caseDetails: null, actions: [] });
  const role = getRole();

  const { setFilters } = useCopilot();

  useEffect(() => {
    setFilters({
      caseId: selectedCaseId,
      channel: channelFilter,
      risk: riskFilter,
      query: searchQuery
    });
    return () => {
      setFilters({});
    };
  }, [selectedCaseId, channelFilter, riskFilter, searchQuery, setFilters]);

  // Load transactions based on selected case dropdown
  useEffect(() => {
    async function loadTransactions() {
      setLoading(true);
      try {
        if (selectedCaseId === 'all') {
          // Fetch transactions across all investigations
          const allPromises = cases.map(c => fetchInvestigation(c.case_id));
          const allDetails = await Promise.all(allPromises);
          const combinedTxs = allDetails.flatMap(d => d.transactions || []);
          // Deduplicate
          const seen = new Set();
          const deduped = [];
          for (const tx of combinedTxs) {
            if (!seen.has(tx.tx_id)) {
              seen.add(tx.tx_id);
              deduped.push(tx);
            }
          }
          setTransactions(deduped);
        } else {
          // Fetch single case transactions
          const details = await fetchInvestigation(selectedCaseId);
          setTransactions(details.transactions || []);
        }
      } catch (err) {
        console.error("Error loading transactions:", err);
      } finally {
        setLoading(false);
      }
    }

    if (cases && cases.length > 0) {
      loadTransactions();
    } else {
      setTransactions([]);
    }
  }, [selectedCaseId, cases]);

  // Formatting helpers
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

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

  // Filter logic
  const filteredTxs = transactions.filter(tx => {
    // 1. Channel Filter
    if (channelFilter !== 'all' && tx.channel !== channelFilter) {
      return false;
    }
    
    // 2. Risk Filter
    const score = tx.risk_score || 0;
    if (riskFilter === 'high' && score < 60) return false;
    if (riskFilter === 'medium' && (score < 40 || score >= 60)) return false;
    if (riskFilter === 'low' && score >= 40) return false;

    // 3. Search Filter (description or sender/receiver accounts)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const sender = (tx.sender_account || '').toLowerCase();
      const receiver = (tx.receiver_account || '').toLowerCase();
      const channel = (tx.channel || '').toLowerCase();
      if (!desc.includes(q) && !sender.includes(q) && !receiver.includes(q) && !channel.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const getRowColor = (score) => {
    if (score >= 80) return "bg-red-950/15 hover:bg-red-950/25 border-l-2 border-l-red-500";
    if (score >= 60) return "bg-orange-950/10 hover:bg-orange-950/20 border-l-2 border-l-orange-500";
    if (score >= 40) return "bg-amber-950/10 hover:bg-amber-950/20 border-l-2 border-l-amber-500";
    return "hover:bg-slate-900/40";
  };

  const handleTxClick = async (tx) => {
    setLoading(true);
    try {
      const details = await fetchInvestigation(tx.case_id);
      setSidebarState({
        isOpen: true,
        tx,
        case: details.case,
        caseDetails: details,
        actions: details.case?.actions_taken || []
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* Header */}
      <header className="p-6 border-b border-slate-900 bg-slate-900/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-7xl mx-auto w-full">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
              Transaction Analysis
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Deep-dive transactional inspection & audit trail filters
            </p>
          </div>

          {/* Top Level Summary Cards */}
          <div className="flex gap-4">
            <div className="bg-slate-900 border border-slate-850 px-4 py-2 rounded-xl text-center min-w-[120px]">
              <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Total Loaded</span>
              <span className="text-lg font-black text-white font-mono">{transactions.length}</span>
            </div>
            <div className="bg-slate-900 border border-slate-850 px-4 py-2 rounded-xl text-center min-w-[120px]">
              <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Filtered Matches</span>
              <span className="text-lg font-black text-indigo-400 font-mono">{filteredTxs.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <section className="p-4 border-b border-slate-900 bg-slate-900/10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Investigation Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 uppercase font-bold">Investigation Case</label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-slate-700 transition-colors"
            >
              <option value="all">All Investigations</option>
              {cases.map((c) => (
                <option key={c.case_id} value={c.case_id}>
                  {c.case_id} ({c.account_id})
                </option>
              ))}
            </select>
          </div>

          {/* Channel Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 uppercase font-bold">Channel</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-slate-700 transition-colors"
            >
              <option value="all">All Channels</option>
              <option value="UPI">UPI</option>
              <option value="IMPS">IMPS</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="ATM">ATM</option>
              <option value="CASH">CASH</option>
              <option value="CHEQUE">CHEQUE</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          {/* Risk Level Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 uppercase font-bold">Risk Level</label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-slate-700 transition-colors"
            >
              <option value="all">All Risk Scores</option>
              <option value="high">High / Critical (&gt;= 60)</option>
              <option value="medium">Medium (40 - 59)</option>
              <option value="low">Low (&lt; 40)</option>
            </select>
          </div>

          {/* Text Search */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 uppercase font-bold">Search Narration / Account</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Search description, accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-slate-700 transition-colors"
              />
            </div>
          </div>

        </div>
      </section>

      {/* Main Table View */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto h-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3"></div>
              <p className="text-xs font-semibold">Loading Transaction Records...</p>
            </div>
          ) : filteredTxs.length > 0 ? (
            <div className="rounded-xl border border-slate-900 bg-slate-900/40 overflow-hidden shadow-2xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-md z-10 border-b border-slate-850">
                  <tr className="text-[10px] uppercase tracking-widest font-black text-slate-500">
                    <th className="p-4">Case ID</th>
                    <th className="p-4">Transaction ID</th>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4 text-center">Channel</th>
                    <th className="p-4">Direction (From/To)</th>
                    <th className="p-4">Description / Narration</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {filteredTxs.map((tx) => (
                    <tr 
                      key={tx.tx_id} 
                      onClick={() => handleTxClick(tx)}
                      className={`transition-colors duration-200 cursor-pointer ${getRowColor(tx.risk_score)}`}
                    >
                      <td className="p-4 font-mono font-bold text-indigo-400 tracking-tight">
                        {tx.case_id}
                      </td>
                      <td className="p-4 font-mono text-slate-400 tracking-tight">
                        {tx.tx_id.substring(0, 14)}...
                      </td>
                      <td className="p-4 text-slate-400 font-mono">
                        {formatTime(tx.timestamp)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-black tracking-wider uppercase">
                          {tx.channel}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 font-mono">
                          <span className={`${tx.is_debit ? "text-indigo-400 font-bold" : "text-slate-400"}`}>
                            {tx.sender_account}
                          </span>
                          <ArrowRight size={10} className="text-slate-600" />
                          <span className={`${!tx.is_debit ? "text-indigo-400 font-bold" : "text-slate-400"}`}>
                            {tx.receiver_account}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-200 truncate max-w-xs" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="p-4 text-right font-bold tracking-tight">
                        <span className={tx.is_debit ? "text-red-400" : "text-emerald-400"}>
                          {formatINR(tx.amount)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <RiskBadge score={tx.risk_score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-900 rounded-xl bg-slate-900/10">
              <span className="text-2xl mb-2">🔍</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">No matching transactions found</h4>
              <p className="text-[10px] text-slate-655 mt-0.5">Try adjusting your filters or search terms.</p>
            </div>
          )}
        </div>
      </div>

      <InvestigationSidebar 
        isOpen={sidebarState.isOpen}
        selectedTransaction={sidebarState.tx}
        selectedCase={sidebarState.case}
        caseDetails={sidebarState.caseDetails}
        onTxSelect={(newTx) => setSidebarState(prev => ({ ...prev, tx: newTx }))}
        onClose={() => setSidebarState({ ...sidebarState, isOpen: false })}
        role={role}
      />
    </div>
  );
}
