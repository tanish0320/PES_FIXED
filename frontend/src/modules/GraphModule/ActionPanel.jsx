import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Compass, ZoomIn, FileText, Calendar, ShieldAlert, 
  XCircle, ArrowRightLeft, RefreshCw, HelpCircle,
  User, Search, GitBranch, Layers, Landmark, CreditCard,
  ChevronDown, ChevronRight
} from 'lucide-react';
import InvestigationLog from './InvestigationLog';
import { getPersonRelationships } from '../../utils/investigationIntelligence';
import { TransactionDrilldownDrawer } from '../../components/InvestigationDrawers';

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

export default function ActionPanel({
  caseId,
  selectedNode,
  onTraceMoneyFlow,
  onExpandNetwork,
  onToggleTimeline,
  onHighlightSuspicious,
  onClearHighlights,
  logs = [],
  onLogClick,
  onStartReplay,
  
  // New intelligence layer props
  transactions = [],
  entities = {},
  onTxSelect,
  onEntitySelect,
  onHighlightTrail,
  globalSearch,
  setGlobalSearch
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('forensics'); // 'forensics' | 'trail' | 'people'
  const [expandedPerson, setExpandedPerson] = useState(null);

  // Group Person to Person relations (Feature 2)
  const peopleRelations = useMemo(() => {
    return getPersonRelationships(transactions, entities);
  }, [transactions, entities]);

  // Filters for search
  const filteredLogs = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter(l => 
      String(l.action || '').toLowerCase().includes(q) ||
      String(l.target || '').toLowerCase().includes(q) ||
      String(l.description || '').toLowerCase().includes(q)
    );
  }, [logs, globalSearch]);

  const filteredPeople = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    if (!q) return peopleRelations;
    return peopleRelations.filter(p => 
      String(p.name || '').toLowerCase().includes(q) ||
      p.accounts?.some(acc => acc.toLowerCase().includes(q))
    );
  }, [peopleRelations, globalSearch]);

  const filteredTxs = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    if (!q) return transactions;
    return transactions.filter(t => 
      String(t.description || '').toLowerCase().includes(q) ||
      String(t.tx_id || '').toLowerCase().includes(q) ||
      String(t.sender_account || '').toLowerCase().includes(q) ||
      String(t.receiver_account || '').toLowerCase().includes(q)
    );
  }, [transactions, globalSearch]);

  return (
    <aside className="w-full bg-slate-950 border-l border-slate-900 flex flex-col p-6 gap-5 h-full text-xs overflow-hidden">
      
      {/* Title */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-900 shrink-0">
        <h3 className="text-xs uppercase font-black text-slate-500 tracking-wider">
          Forensic Toolkit
        </h3>
        <span className="text-[10px] font-bold text-slate-600 font-mono">v2.0L-REST</span>
      </div>

      {/* Intelligence search bar (Feature 10) */}
      <div className="relative shrink-0">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
          <Search size={13} />
        </span>
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Filter toolkit & highlight graph..."
          className="w-full bg-slate-900 border border-slate-850 py-2 pl-8 pr-3 rounded-lg text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500/80 transition-all placeholder-slate-655 font-bold"
        />
      </div>

      {/* Intelligence layer tab selector */}
      <div className="flex gap-1 border-b border-slate-900 pb-1 shrink-0">
        <button
          onClick={() => setActiveTab('forensics')}
          className={`flex-1 pb-1.5 font-bold text-[10px] text-center border-b-2 transition-all ${
            activeTab === 'forensics' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Forensics
        </button>
        <button
          onClick={() => setActiveTab('trail')}
          className={`flex-1 pb-1.5 font-bold text-[10px] text-center border-b-2 transition-all ${
            activeTab === 'trail' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Money Trails
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={`flex-1 pb-1.5 font-bold text-[10px] text-center border-b-2 transition-all ${
            activeTab === 'people' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          P2P Relations
        </button>
      </div>

      {/* Dynamic Content Panel */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
        {activeTab === 'forensics' && (
          <div className="space-y-4">
            {/* Active Investigation */}
            <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-3">
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Active Case ID</span>
                <span className="text-sm font-mono font-bold text-white block mt-0.5">{caseId}</span>
              </div>
              
              <div className="border-t border-slate-850 pt-3">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Selected Target Node</span>
                {selectedNode ? (
                  <div className="flex justify-between items-center mt-1">
                    <div>
                      <p className="text-xs font-mono font-bold text-indigo-400 truncate max-w-[150px]" title={selectedNode.id}>
                        {selectedNode.label || selectedNode.id}
                      </p>
                      <p className="text-[9px] text-slate-500 capitalize">{selectedNode.nodeType}</p>
                    </div>
                    <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850 font-bold text-[9px] text-slate-300">
                      Risk: {selectedNode.risk}%
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 italic mt-1">
                    Click any node in graph to unlock targeted actions
                  </p>
                )}
              </div>
            </div>

            {/* Forensics Action Buttons */}
            <div className="space-y-2">
              <button 
                onClick={onTraceMoneyFlow}
                disabled={!selectedNode}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg text-xs shadow-md transition-all disabled:pointer-events-none"
              >
                <Compass size={14} />
                Trace Money Flow
              </button>

              <button 
                onClick={onExpandNetwork}
                disabled={!selectedNode}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 disabled:opacity-50 text-slate-350 font-bold py-2.5 px-4 rounded-lg text-xs transition-all disabled:pointer-events-none"
              >
                <ZoomIn size={14} />
                Expand Network (2 Hops)
              </button>

              <button 
                onClick={onHighlightSuspicious}
                className="w-full flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 font-bold py-2.5 px-4 rounded-lg text-xs transition-all"
              >
                <ShieldAlert size={14} />
                Highlight Suspicious Node/Edge
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={onToggleTimeline}
                  className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-semibold py-2 px-3 rounded-lg text-[11px] transition-all"
                >
                  <Calendar size={13} />
                  Timeline
                </button>
                <button 
                  onClick={onClearHighlights}
                  className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-semibold py-2 px-3 rounded-lg text-[11px] transition-all"
                >
                  <XCircle size={13} />
                  Reset View
                </button>
              </div>

              <button 
                onClick={onStartReplay}
                className="w-full flex items-center justify-center gap-2 bg-indigo-950/30 hover:bg-indigo-900/50 border border-indigo-900/30 text-indigo-400 font-bold py-2.5 px-4 rounded-lg text-xs transition-all"
              >
                <RefreshCw size={13} />
                Run Investigation Replay
              </button>

              <button 
                onClick={() => navigate(`/report/${caseId}`)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs shadow-md shadow-blue-950/30 transition-all"
              >
                <FileText size={14} />
                Generate Investigation Report
              </button>
            </div>

            {/* Investigation Log */}
            <div className="border-t border-slate-900 pt-4">
              <InvestigationLog logs={filteredLogs} onLogClick={onLogClick} />
            </div>
          </div>
        )}

        {/* MONEY TRAILS TAB (Feature 1) */}
        {activeTab === 'trail' && (
          <div className="space-y-3">
            <h4 className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">
              Flagged Transactions for Trail Tracing
            </h4>
            <div className="space-y-1.5">
              {filteredTxs.filter(t => t.risk_score >= 60 || t.amount >= 50000).slice(0, 30).map((tx, idx) => (
                <div
                  key={idx}
                  onClick={() => onTxSelect(tx)}
                  className="bg-slate-900/40 border border-slate-850 hover:border-indigo-500/50 p-2.5 rounded-lg cursor-pointer transition-all flex justify-between items-center text-[10px] gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-200 truncate">{tx.description}</p>
                    <span className="text-slate-500 font-mono text-[8px] mt-0.5 block truncate">
                      {tx.sender_account} → {tx.receiver_account}
                    </span>
                  </div>
                  <span className={`font-black shrink-0 ${tx.is_debit ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatINR(tx.amount)}
                  </span>
                </div>
              ))}
              {filteredTxs.filter(t => t.risk_score >= 60 || t.amount >= 50000).length === 0 && (
                <p className="text-slate-655 italic text-center py-4">No matching high-risk transactions.</p>
              )}
            </div>
          </div>
        )}

        {/* P2P RELATIONS TAB (Feature 2) */}
        {activeTab === 'people' && (
          <div className="space-y-3">
            <h4 className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">
              Person Groupings & Financial Flows
            </h4>
            <div className="space-y-2">
              {filteredPeople.map((person, idx) => {
                const isExpanded = expandedPerson === idx;
                return (
                  <div 
                    key={idx} 
                    className="bg-slate-900/50 border border-slate-850 rounded-xl overflow-hidden"
                  >
                    <div 
                      onClick={() => setExpandedPerson(isExpanded ? null : idx)}
                      className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-900/70 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-slate-200">{person.name}</h4>
                        <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Risk Rating: {person.risk}%</span>
                      </div>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    {isExpanded && (
                      <div className="p-3 border-t border-slate-950 bg-slate-950/40 space-y-3 text-[10px]">
                        <div className="grid grid-cols-2 gap-2 text-center font-mono">
                          <div className="bg-slate-900/50 p-2 rounded">
                            <span className="text-slate-500 block text-[8px] uppercase">Money Sent</span>
                            <span className="text-red-400 font-black mt-0.5 block">{formatINR(person.moneySent)}</span>
                          </div>
                          <div className="bg-slate-900/50 p-2 rounded">
                            <span className="text-slate-500 block text-[8px] uppercase">Money Received</span>
                            <span className="text-emerald-400 font-black mt-0.5 block">{formatINR(person.moneyReceived)}</span>
                          </div>
                        </div>

                        <div className="space-y-1 text-slate-400">
                          <p><span className="text-slate-500 font-bold uppercase text-[8px] mr-1">Linked Accounts:</span> {person.accounts.join(', ')}</p>
                          {person.upiIds.length > 0 && <p><span className="text-slate-500 font-bold uppercase text-[8px] mr-1">UPI IDs:</span> {person.upiIds.join(', ')}</p>}
                          {person.merchants.length > 0 && <p><span className="text-slate-500 font-bold uppercase text-[8px] mr-1">Merchants:</span> {person.merchants.join(', ')}</p>}
                          <p><span className="text-slate-500 font-bold uppercase text-[8px] mr-1">Avg Hold Time:</span> {person.holdingTime}</p>
                          <p><span className="text-slate-500 font-bold uppercase text-[8px] mr-1">Net Flow:</span> <span className={person.netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatINR(person.netFlow)}</span></p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => onEntitySelect({ value: person.name, type: 'name', risk: person.risk, source_tx_ids: person.transactions.map(t => t.tx_id), linked_accounts: person.accounts })}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 py-1.5 px-3 rounded-lg text-[9px] font-bold transition-all text-center"
                          >
                            Intelligence File
                          </button>
                          <button
                            onClick={() => onTxSelect(person.transactions[0])}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-3 rounded-lg text-[9px] font-bold transition-all text-center shadow"
                          >
                            Linked Txs
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredPeople.length === 0 && (
                <p className="text-slate-655 italic text-center py-4">No matching people found.</p>
              )}
            </div>
          </div>
        )}
      </div>

    </aside>
  );
}
