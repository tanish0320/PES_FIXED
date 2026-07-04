import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Search, ShieldAlert, AlertTriangle, ArrowRight, User, 
  CreditCard, Building, GitBranch, Layers, FileText, CheckCircle, 
  Clock, ChevronRight, ChevronDown, Check, Landmark, RefreshCw
} from 'lucide-react';
import { reconstructMoneyTrail, getFailedTransactionAnalysis } from '../utils/investigationIntelligence';

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

/**
 * Collapsible Tree Node for Tree Mode Money Trail Explorer
 */
const MoneyTrailTreeNode = ({ node, isIncoming = false, onTxClick }) => {
  const [expanded, setExpanded] = useState(true);
  const items = isIncoming ? node.parents : node.children;
  const hasChildren = items && items.length > 0;

  return (
    <div className="pl-4 border-l border-slate-800 my-1.5">
      <div className="flex items-center gap-2">
        {hasChildren && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="p-0.5 hover:bg-slate-800 rounded text-slate-500"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
        <div 
          onClick={() => onTxClick(node.tx)}
          className={`flex-1 bg-slate-900/60 border border-slate-850 hover:border-indigo-500/50 p-2.5 rounded-lg cursor-pointer transition-all flex justify-between items-center gap-3 ${
            node.isCircular ? 'border-red-500/30 bg-red-950/10' : ''
          }`}
        >
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="font-mono">{new Date(node.tx.date).toLocaleDateString()}</span>
              <span>•</span>
              <span className="font-mono">{node.tx.channel}</span>
            </div>
            <p className="text-xs font-bold text-slate-200 truncate">{node.tx.description}</p>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {isIncoming ? `${node.tx.sender_account} → A/C` : `A/C → ${node.tx.receiver_account}`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-xs font-black ${node.tx.is_debit ? 'text-red-400' : 'text-emerald-400'}`}>
              {node.tx.is_debit ? '-' : '+'}{formatINR(node.tx.amount)}
            </span>
            {node.isCircular && (
              <span className="block text-[8px] font-black uppercase text-red-400 tracking-wider">
                Loop
              </span>
            )}
          </div>
        </div>
      </div>
      
      {expanded && hasChildren && (
        <div className="space-y-1 mt-1.5">
          {items.map((child, idx) => (
            <MoneyTrailTreeNode 
              key={idx} 
              node={child} 
              isIncoming={isIncoming} 
              onTxClick={onTxClick} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Money Trail Explorer Component
 */
const MoneyTrailExplorer = ({ transaction, allTransactions, onHighlightOnGraph, onTxSelect }) => {
  const [mode, setMode] = useState('tree'); // 'tree' | 'timeline'
  
  const trail = useMemo(() => {
    return reconstructMoneyTrail(transaction, allTransactions);
  }, [transaction, allTransactions]);

  const treeNodesCount = useMemo(() => {
    let count = 1;
    const countNodes = (list) => {
      if (!list) return;
      list.forEach(item => {
        count++;
        countNodes(item.children || item.parents);
      });
    };
    countNodes(trail.origin);
    countNodes(trail.destination);
    return count;
  }, [trail]);

  // Extract flat transaction IDs and account IDs from the trail for highlighting on the graph
  const handleGraphHighlightClick = () => {
    const txIds = [transaction.tx_id];
    const nodeIds = [transaction.sender_account, transaction.receiver_account];

    const collectIds = (list) => {
      if (!list) return;
      list.forEach(item => {
        txIds.push(item.tx.tx_id);
        nodeIds.push(item.tx.sender_account, item.tx.receiver_account);
        collectIds(item.children || item.parents);
      });
    };

    collectIds(trail.origin);
    collectIds(trail.destination);
    
    // Filter unique values
    onHighlightOnGraph(Array.from(new Set(txIds)), Array.from(new Set(nodeIds.filter(id => id && id !== 'external'))));
  };

  // Flat chronological list for Timeline Mode
  const flatTimeline = useMemo(() => {
    const list = [{ tx: transaction, type: 'Target' }];
    
    const collectFlat = (items, type) => {
      if (!items) return;
      items.forEach(item => {
        list.push({ tx: item.tx, type, isCircular: item.isCircular });
        collectFlat(item.children || item.parents, type);
      });
    };

    collectFlat(trail.origin, 'Origin Source');
    collectFlat(trail.destination, 'Forward Distribution');

    // Sort chronologically
    return list.sort((a, b) => new Date(a.tx.date) - new Date(b.tx.date));
  }, [trail, transaction]);

  return (
    <div className="space-y-4 border border-slate-850 bg-slate-950 p-4 rounded-xl">
      <div className="flex justify-between items-center border-b border-slate-850 pb-2">
        <h4 className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
          <GitBranch size={13} className="text-indigo-400" /> Money Trail Explorer
        </h4>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMode('tree')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              mode === 'tree' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Tree View
          </button>
          <button 
            onClick={() => setMode('timeline')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              mode === 'timeline' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Flow Timeline
          </button>
          <button
            onClick={handleGraphHighlightClick}
            className="bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-black transition-all flex items-center gap-1"
          >
            Graph Highlight
          </button>
        </div>
      </div>

      {trail.hasCircular && (
        <div className="bg-red-950/20 border border-red-500/25 rounded-lg p-2.5 flex items-center gap-2 text-[10px] text-red-400 animate-pulse">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="font-bold">Circular Flow Detected!</span>
          <span>Funds route back to previous entities in the transaction chain.</span>
        </div>
      )}

      <div className="text-[10px] text-slate-500 font-mono">
        Reconstructed <span className="text-indigo-400 font-bold">{treeNodesCount} hops</span> of money movement.
      </div>

      {mode === 'tree' ? (
        <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
          {/* Incoming Money Flow (Origins) */}
          {trail.origin.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">
                Incoming Sources
              </span>
              {trail.origin.map((node, idx) => (
                <MoneyTrailTreeNode 
                  key={idx} 
                  node={node} 
                  isIncoming={true} 
                  onTxClick={onTxSelect} 
                />
              ))}
            </div>
          )}

          {/* Current Selection target node */}
          <div className="border-l-2 border-indigo-500 pl-4 bg-indigo-950/10 p-3 rounded-lg border border-slate-800/80">
            <span className="text-[9px] uppercase font-black tracking-wider text-indigo-400 block mb-1">
              Active Selection
            </span>
            <div className="flex justify-between items-center gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-200 truncate">{transaction.description}</p>
                <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                  Ref: {transaction.tx_id} • {new Date(transaction.date).toLocaleString()}
                </p>
              </div>
              <span className="text-xs font-black text-indigo-400 shrink-0">
                {formatINR(transaction.amount)}
              </span>
            </div>
          </div>

          {/* Outbound Money Flow (Destinations) */}
          {trail.destination.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">
                Outgoing Beneficiaries
              </span>
              {trail.destination.map((node, idx) => (
                <MoneyTrailTreeNode 
                  key={idx} 
                  node={node} 
                  isIncoming={false} 
                  onTxClick={onTxSelect} 
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {flatTimeline.map((item, idx) => (
            <div 
              key={idx} 
              onClick={() => onTxSelect(item.tx)}
              className={`border border-slate-850 p-2.5 rounded-lg hover:border-slate-700 cursor-pointer transition-all flex justify-between items-center gap-3 ${
                item.type === 'Target' 
                  ? 'bg-indigo-950/20 border-indigo-500/30' 
                  : item.isCircular 
                    ? 'bg-red-950/10 border-red-500/25'
                    : 'bg-slate-900/30'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] uppercase font-black px-1 rounded ${
                    item.type === 'Target' 
                      ? 'bg-indigo-500/25 text-indigo-300' 
                      : item.type === 'Origin Source' 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-red-500/10 text-red-400'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {new Date(item.tx.date).toLocaleDateString()} {new Date(item.tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-200 truncate mt-1">{item.tx.description}</p>
                <p className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
                  {item.tx.sender_account} → {item.tx.receiver_account}
                </p>
              </div>
              <span className={`text-xs font-black ${item.tx.is_debit ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatINR(item.tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * TRANSACTION DRILLDOWN DRAWER (Feature 9)
 */
export const TransactionDrilldownDrawer = ({ transaction, allTransactions, onClose, onHighlightOnGraph }) => {
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'moneyTrail'
  const [selectedTx, setSelectedTx] = useState(transaction);

  useEffect(() => {
    setSelectedTx(transaction);
  }, [transaction]);

  if (!transaction) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-slate-950/95 border-l border-slate-900 shadow-2xl z-50 p-6 flex flex-col gap-5 backdrop-blur-md animate-in slide-in-from-right-4">
      <div className="flex justify-between items-center pb-3 border-b border-slate-900">
        <div>
          <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Transaction Intelligence</span>
          <h3 className="text-xs font-mono font-bold text-slate-200 mt-0.5 truncate max-w-[280px]" title={selectedTx.tx_id}>
            ID: {selectedTx.tx_id}
          </h3>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-900 pb-1">
        <button 
          onClick={() => setActiveTab('details')}
          className={`flex-1 pb-2 text-[11px] font-bold border-b-2 text-center transition-all ${
            activeTab === 'details' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Details
        </button>
        <button 
          onClick={() => setActiveTab('moneyTrail')}
          className={`flex-1 pb-2 text-[11px] font-bold border-b-2 text-center transition-all ${
            activeTab === 'moneyTrail' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Money Trail Map
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {activeTab === 'details' ? (
          <div className="space-y-4">
            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl text-center space-y-1">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500">Transaction Value</span>
              <p className={`text-2xl font-black ${selectedTx.is_debit ? 'text-red-400' : 'text-emerald-400'}`}>
                {selectedTx.is_debit ? '-' : '+'}{formatINR(selectedTx.amount)}
              </p>
              {selectedTx.risk_score !== undefined && (
                <span className="inline-block text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded mt-2">
                  Risk Score: {selectedTx.risk_score}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-900">
                <span className="text-slate-500 block text-[9px] uppercase font-bold">Channel</span>
                <span className="font-semibold text-slate-300 font-mono">{selectedTx.channel}</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-900">
                <span className="text-slate-500 block text-[9px] uppercase font-bold">Date / Time</span>
                <span className="font-semibold text-slate-300">{new Date(selectedTx.date).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Description Narration</span>
              <p className="bg-slate-900/60 border border-slate-900 p-3 rounded-lg font-mono text-slate-200 select-all whitespace-pre-wrap">
                {selectedTx.description}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase font-black text-slate-500">Sender Account</span>
                  <p className="text-xs font-mono font-bold text-slate-300 truncate select-all">{selectedTx.sender_account}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase font-black text-slate-500">Receiver Account</span>
                  <p className="text-xs font-mono font-bold text-slate-300 truncate select-all">{selectedTx.receiver_account}</p>
                </div>
              </div>
            </div>

            {selectedTx.balance_after !== null && selectedTx.balance_after !== undefined && (
              <div className="bg-slate-900/60 border border-slate-900 p-3 rounded-lg text-[11px] flex justify-between">
                <span className="text-slate-500 font-bold uppercase">Balance After Tx</span>
                <span className="font-bold text-slate-300">{formatINR(selectedTx.balance_after)}</span>
              </div>
            )}

            {/* Pattern Link Card */}
            {selectedTx.reason && (
              <div className="bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-xl space-y-2">
                <h4 className="text-[10px] uppercase font-black tracking-wider text-amber-500 flex items-center gap-1.5">
                  <ShieldAlert size={14} /> Suspicious Link Details
                </h4>
                <p className="text-[11px] leading-relaxed text-slate-300">{selectedTx.reason}</p>
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-slate-900">
              <button
                onClick={() => {
                  if (onHighlightOnGraph) {
                    onHighlightOnGraph([selectedTx.tx_id], [selectedTx.sender_account, selectedTx.receiver_account].filter(id => id && id !== 'external'));
                  }
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-md transition-all text-center"
              >
                Highlight on Graph
              </button>
              <button
                onClick={() => setActiveTab('moneyTrail')}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 px-4 rounded-lg text-xs transition-all border border-slate-700 text-center"
              >
                Money Trail Explorer
              </button>
            </div>
          </div>
        ) : (
          <MoneyTrailExplorer 
            transaction={selectedTx} 
            allTransactions={allTransactions} 
            onHighlightOnGraph={onHighlightOnGraph} 
            onTxSelect={setSelectedTx}
          />
        )}
      </div>
    </div>
  );
};

/**
 * ENTITY INTELLIGENCE PANEL (Feature 6)
 */
export const EntityIntelligencePanel = ({ entity, allTransactions, initialNotes = '', onSaveNotes, onClose, onHighlightOnGraph, onExplainRisk }) => {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
    setIsSaved(false);
  }, [entity, initialNotes]);

  if (!entity) return null;

  // Calculate flow totals for this entity
  const linkedTxIds = new Set(entity.source_tx_ids || []);
  const linkedTxs = allTransactions.filter(t => linkedTxIds.has(t.tx_id));
  
  const moneyReceived = linkedTxs.filter(t => !t.is_debit).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const moneySent = linkedTxs.filter(t => t.is_debit).reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
    setIsSaved(false);
  };

  const handleNotesSave = () => {
    if (onSaveNotes) {
      onSaveNotes(entity.value, notes);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-slate-950/95 border-l border-slate-900 shadow-2xl z-50 p-6 flex flex-col gap-5 backdrop-blur-md animate-in slide-in-from-right-4">
      <div className="flex justify-between items-center pb-3 border-b border-slate-900">
        <div>
          <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider bg-slate-900 px-2 py-0.5 rounded">{entity.type?.replace('_', ' ')}</span>
          <h3 className="text-xs font-mono font-bold text-slate-200 mt-1 truncate max-w-[280px]" title={entity.value}>
            {entity.value}
          </h3>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-900">
            <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">Occurrences</span>
            <span className="text-sm font-black text-slate-200 mt-1 block">{linkedTxs.length} Times</span>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-900">
            <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">Entity Risk</span>
            <span className="text-sm font-black text-amber-500 mt-1 block">{entity.risk || 40}%</span>
          </div>
        </div>

        {/* Financial Flow */}
        <div className="bg-slate-900/40 border border-slate-900/60 p-4 rounded-xl space-y-3">
          <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Money Flow Analysis</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Money Sent</span>
              <span className="text-xs font-bold text-red-400 block mt-0.5">{formatINR(moneySent)}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Money Received</span>
              <span className="text-xs font-bold text-emerald-400 block mt-0.5">{formatINR(moneyReceived)}</span>
            </div>
          </div>
        </div>

        {/* Linked Accounts */}
        <div className="space-y-2">
          <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-500">Linked Statement Accounts</h4>
          <div className="flex flex-wrap gap-1.5">
            {entity.linked_accounts && entity.linked_accounts.length > 0 ? (
              entity.linked_accounts.map((acc, idx) => (
                <span key={idx} className="bg-slate-900 border border-slate-850 px-2.5 py-1 rounded text-[10px] font-mono text-slate-300">
                  {acc}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">No direct accounts linked.</span>
            )}
          </div>
        </div>

        {/* Associated Transactions list */}
        <div className="space-y-2">
          <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-500">Transaction Appearances</h4>
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto border border-slate-900 rounded-lg p-2 bg-slate-950/50">
            {linkedTxs.map((t, idx) => (
              <div 
                key={idx}
                className="bg-slate-900/30 border border-slate-900/60 p-2 rounded flex justify-between items-center text-[10px] gap-2 hover:border-slate-700 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-200 truncate">{t.description}</p>
                  <span className="text-slate-500 font-mono text-[9px] block mt-0.5">{new Date(t.date).toLocaleDateString()}</span>
                </div>
                <span className={`font-bold shrink-0 ${t.is_debit ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatINR(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Officer Notes Textarea (Feature 6) */}
        <div className="space-y-2 pt-2 border-t border-slate-900">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-500">Analyst Officer Notes</h4>
            <button 
              onClick={handleNotesSave}
              className={`text-[10px] font-black px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                isSaved 
                  ? 'bg-emerald-600/25 text-emerald-400' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
              }`}
            >
              {isSaved ? <Check size={11} /> : null}
              {isSaved ? 'Notes Saved' : 'Save Notes'}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={handleNotesChange}
            placeholder="Type notes about this entity (e.g. verified KYC, suspicious UPI merchant, potential mule link)..."
            className="w-full h-24 bg-slate-900 border border-slate-850 p-3 rounded-lg text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium resize-none leading-relaxed"
          />
        </div>
      </div>

      <div className="pt-3 border-t border-slate-900 flex gap-2">
        <button
          onClick={() => {
            if (onHighlightOnGraph) {
              onHighlightOnGraph(Array.from(linkedTxIds), Array.from(entity.linked_accounts || []));
            }
          }}
          className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 rounded-lg text-xs border border-slate-700 transition-all text-center"
        >
          Highlight Network
        </button>
        {onExplainRisk && (
          <button
            onClick={() => onExplainRisk(entity)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs shadow-md transition-all text-center"
          >
            Explain Risk
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * CATEGORY DRILLDOWN DRAWER (Feature 3)
 */
export const CategoryDrilldownDrawer = ({ category, transactions, onClose, onTxSelect }) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Search filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t => 
      String(t.description || '').toLowerCase().includes(q) ||
      String(t.tx_id || '').toLowerCase().includes(q) ||
      String(t.sender_account || '').toLowerCase().includes(q) ||
      String(t.receiver_account || '').toLowerCase().includes(q) ||
      String(t.channel || '').toLowerCase().includes(q)
    );
  }, [transactions, search]);

  // Pagination for virtualization / performance (Feature 12)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(0, start + pageSize); // progressive loading style
  }, [filtered, currentPage]);

  const hasMore = paginated.length < filtered.length;

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-slate-950/95 border-l border-slate-900 shadow-2xl z-50 p-6 flex flex-col gap-4 backdrop-blur-md animate-in slide-in-from-right-4">
      <div className="flex justify-between items-center pb-3 border-b border-slate-900">
        <div>
          <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Dashboard Drilldown</span>
          <h3 className="text-xs uppercase font-black text-slate-200 mt-0.5">
            Category: {category} ({filtered.length} Transactions)
          </h3>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
          <X size={18} />
        </button>
      </div>

      {/* Local search filtering */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search size={14} />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Filter category transactions (narration, account, ref ID)..."
          className="w-full bg-slate-900 border border-slate-850 py-2.5 pl-10 pr-4 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition-all placeholder-slate-600 font-medium"
        />
      </div>

      {/* Transaction Table */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-[10px] text-slate-500 font-extrabold uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Narration</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((tx, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => onTxSelect(tx)}
                  className="border-b border-slate-900 hover:bg-slate-900/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono text-[9px] text-slate-400">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 min-w-[200px] max-w-[240px]">
                    <div className="font-bold text-slate-200 truncate">{tx.description}</div>
                    <span className="text-[9px] font-mono text-slate-500 block truncate">{tx.sender_account} → {tx.receiver_account}</span>
                  </td>
                  <td className={`py-2.5 px-3 text-right font-black shrink-0 ${tx.is_debit ? 'text-red-400' : 'text-emerald-400'}`}>
                    {tx.is_debit ? '-' : '+'}{formatINR(tx.amount)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="3" className="py-8 text-center text-slate-500 italic">No matching transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <button 
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-850 py-2 rounded-xl text-[10px] font-black transition-all mt-3"
          >
            Load More Transactions
          </button>
        )}
      </div>
    </div>
  );
};
