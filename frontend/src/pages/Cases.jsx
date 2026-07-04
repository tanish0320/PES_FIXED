import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../hooks/useDataStore';
import RiskBadge from '../components/RiskBadge';
import InvestigationSidebar from '../components/InvestigationSidebar';
import { getRole } from '../roleStore';
import { FileText, GitBranch, Eye, HelpCircle } from 'lucide-react';

export default function Cases() {
  const navigate = useNavigate();
  const { cases, fetchInvestigations, fetchInvestigation } = useDataStore();
  const [filter, setFilter] = useState('ALL');
  const [sidebarState, setSidebarState] = useState({ isOpen: false, case: null, tx: null, caseDetails: null, actions: [] });
  const role = getRole();

  const ALL_STATUSES = ['ALL', 'NEW', 'ANALYZED', 'HIGH_RISK', 'FLAGGED'];

  useEffect(() => {
    fetchInvestigations();
  }, []);

  const filteredCases = filter === 'ALL' 
    ? cases 
    : cases.filter(c => c.status === filter);

  const handleRowClick = async (c) => {
    try {
      const details = await fetchInvestigation(c.case_id);
      const firstTx = details.transactions?.[0] || null;
      setSidebarState({
        isOpen: true,
        case: details.case,
        caseDetails: details,
        tx: firstTx,
        actions: details.case?.actions_taken || []
      });
    } catch (err) {
      console.error("Failed to load investigation details:", err);
    }
  };

  const getStatusColor = (s) => {
    if (s === 'HIGH_RISK') return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'ANALYZED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'FLAGGED') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-slate-500/10 text-slate-400 border-slate-750';
  };

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-slate-100 space-y-8">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
            Investigations Manager
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Browse and manage all automated bank statement audits
          </p>
        </div>
        
        {/* Status Filters */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1 flex-wrap">
          {ALL_STATUSES.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                filter === f 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-900 bg-slate-900/40 overflow-hidden shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-md border-b border-slate-850">
            <tr className="text-[10px] uppercase tracking-widest font-black text-slate-500">
              <th className="p-4">Investigation ID</th>
              <th className="p-4">Target Account</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-center">Risk Score</th>
              <th className="p-4 text-center">Patterns</th>
              <th className="p-4 text-center">Parser Conf.</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 text-xs">
            {filteredCases.map((c) => (
              <tr 
                key={c.case_id} 
                onClick={() => handleRowClick(c)}
                className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
              >
                <td className="p-4 font-mono font-bold text-indigo-400 tracking-tight">
                  {c.case_id}
                </td>
                <td className="p-4 font-mono text-slate-300 font-semibold">
                  {c.account_id}
                </td>
                <td className="p-4">
                  <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${getStatusColor(c.status)}`}>
                    {c.status}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <RiskBadge score={c.risk_score} />
                </td>
                <td className="p-4 text-center font-bold font-mono text-slate-300">
                  {c.pattern_count}
                </td>
                <td className={`p-4 text-center font-bold ${c.parser_confidence >= 90 ? "text-emerald-400" : "text-amber-400"}`}>
                  {c.parser_confidence}%
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/graph/${c.case_id}`)}
                      className="bg-slate-800 hover:bg-slate-700 text-gray-300 font-semibold py-1.5 px-3 rounded-lg text-[10px] transition-all flex items-center gap-1 border border-slate-750"
                    >
                      <GitBranch size={10} />
                      Graph
                    </button>
                    <button
                      onClick={() => navigate(`/report/${c.case_id}`)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-1.5 px-3 rounded-lg text-[10px] shadow-md transition-all flex items-center gap-1"
                    >
                      <FileText size={10} />
                      Report
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCases.length === 0 && (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500 italic">
                  No investigations match the selected status filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <InvestigationSidebar 
        isOpen={sidebarState.isOpen}
        selectedCase={sidebarState.case}
        selectedTransaction={sidebarState.tx}
        caseDetails={sidebarState.caseDetails}
        onTxSelect={(newTx) => setSidebarState(prev => ({ ...prev, tx: newTx }))}
        onClose={() => setSidebarState({ ...sidebarState, isOpen: false })}
        role={role}
      />
    </div>
  );
}
