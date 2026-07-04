import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, AlertTriangle, ShieldAlert, Clock, Info, User, 
  CreditCard, Building, GitBranch, ArrowRight, Activity,
  Globe, Landmark, DollarSign, Tag, Terminal
} from 'lucide-react';
import RiskBadge from './RiskBadge';
import FactorBreakdown from './FactorBreakdown';
import { maskAccount } from '../utils/maskAccount';
import { twMerge } from 'tailwind-merge';

const formatINR = (value) => {
  if (value === undefined || value === null) return '₹0';
  try {
    const num = Math.round(Number(value));
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

const extractEntities = (description) => {
  if (!description) return { upi_ids: [], ifsc_codes: [], account_numbers: [], names: [], merchants: [] };
  
  const desc = String(description);
  const upiRegex = /([\w\-.]+@[\w\-.]+)/g;
  const ifscRegex = /\b([A-Z]{4}0[A-Z0-9]{6})\b/gi;
  const accRegex = /\b(\d{9,18})\b/g;

  const upi_ids = Array.from(new Set(desc.match(upiRegex) || []));
  const ifsc_codes = Array.from(new Set((desc.match(ifscRegex) || []).map(i => i.toUpperCase())));
  const account_numbers = Array.from(new Set(desc.match(accRegex) || []));

  // Exclude keywords for names
  const excludeKeywords = new Set([
    "imps", "upi", "neft", "rtgs", "cash", "atm", "transfer", "family", "inb", 
    "rtn", "chg", "fee", "tax", "charges", "interest", "rev", "gst", "clearing",
    "clg", "self", "own", "acct", "account", "commission", "withdrawal", "deposit",
    "savings", "current", "salary", "loan", "card", "mobile", "biller", "payment"
  ]);

  const names = [];
  const descUpper = desc.toUpperCase();

  if (descUpper.includes("NEFT")) {
    const parts = desc.split("-").map(p => p.trim()).filter(Boolean);
    parts.forEach(part => {
      if (part.length >= 4 && /^[a-zA-Z\s]+$/.test(part) && !excludeKeywords.has(part.toLowerCase())) {
        names.push(part);
      }
    });
  }
  if (descUpper.includes("IMPS") || descUpper.includes("MMT/IMPS")) {
    const parts = desc.split("/").map(p => p.trim()).filter(Boolean);
    parts.forEach(part => {
      if (part.length >= 4 && /^[a-zA-Z\s]+$/.test(part) && !excludeKeywords.has(part.toLowerCase())) {
        names.push(part);
      }
    });
  }

  // Generic candidate name extraction
  const tokens = desc.split(/[\s/\-|,]+/);
  const nameCandidateWords = [];
  tokens.forEach(token => {
    if (token.length >= 3 && /^[A-Z]+$/.test(token) && !excludeKeywords.has(token.toLowerCase())) {
      nameCandidateWords.push(token);
    }
  });
  if (nameCandidateWords.length >= 2) {
    names.push(nameCandidateWords.join(" "));
  }

  // Merchant extraction
  const merchants = [];
  const merchantKeywords = [
    "paytm", "amazon", "google pay", "gpay", "flipkart", "zomato", "swiggy", 
    "uber", "ola", "netflix", "phonepe", "razorpay", "billdesk", "rummy", 
    "junglee", "dream11", "cred", "bbps", "irctc"
  ];
  const descLower = desc.toLowerCase();
  merchantKeywords.forEach(kw => {
    if (descLower.includes(kw)) {
      merchants.push(kw.charAt(0).toUpperCase() + kw.slice(1));
    }
  });

  return {
    upi_ids,
    ifsc_codes,
    account_numbers,
    names: Array.from(new Set(names)),
    merchants: Array.from(new Set(merchants))
  };
};

const InvestigationSidebar = ({ 
  isOpen, 
  selectedCase, 
  selectedTransaction, 
  onClose,
  role,
  caseDetails,
  onTxSelect // optional callback to select a different transaction in mini-timeline
}) => {
  const navigate = useNavigate();
  if (!isOpen) return null;
  const isViewer = role !== 'admin';

  // Extract entities from current transaction description
  const entities = useMemo(() => {
    return extractEntities(selectedTransaction?.description);
  }, [selectedTransaction]);

  // Find related patterns from the case report
  const relatedPatterns = useMemo(() => {
    const patternsList = caseDetails?.patterns || caseDetails?.report?.detected_patterns || [];
    if (!patternsList || !selectedTransaction) return [];
    return patternsList.filter(pat => 
      pat.related_transactions?.includes(selectedTransaction.tx_id)
    );
  }, [caseDetails, selectedTransaction]);

  // Build a mini chronological timeline around the selected transaction
  const miniTimeline = useMemo(() => {
    if (!caseDetails?.transactions || !selectedTransaction) return [];
    const sorted = [...caseDetails.transactions].sort((a, b) => new Date(a.timestamp || a.date) - new Date(b.timestamp || b.date));
    const idx = sorted.findIndex(t => t.tx_id === selectedTransaction.tx_id);
    if (idx === -1) return [];
    
    // Get up to 2 before and 2 after
    const start = Math.max(0, idx - 2);
    const end = Math.min(sorted.length, idx + 3);
    return sorted.slice(start, end);
  }, [caseDetails, selectedTransaction]);

  const caseId = selectedCase?.case_id || selectedTransaction?.case_id || caseDetails?.case?.case_id;

  const handleViewInGraph = () => {
    if (caseId) {
      navigate(`/graph/${caseId}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md animate-in slide-in-from-right duration-300">
          <div className="h-full flex flex-col bg-slate-950 border-l border-slate-900 shadow-2xl overflow-y-auto">
            
            {/* Header - Sticky */}
            <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md border-b border-slate-900 p-6 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-[9px] text-slate-500 uppercase font-black tracking-widest bg-slate-900 px-2 py-0.5 rounded inline-block">
                  Forensic Examination
                </h2>
                <p className="text-lg font-black tracking-tighter mt-1 text-slate-200">
                  {caseId || 'STANDALONE TRANSACTION'}
                </p>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-slate-900 text-slate-500 hover:text-slate-300 rounded-full transition-colors">
                <X size={18} />
              </button>
            </header>

            {/* Content Body */}
            <div className="flex-1 p-6 space-y-6">
              
              {/* Transaction Context */}
              {selectedTransaction && (
                <section className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Transaction Profile</h3>
                    <span className={twMerge(
                      "text-[9px] px-2 py-0.5 rounded font-black border uppercase tracking-wider",
                      selectedTransaction.is_debit 
                        ? "bg-red-500/10 text-red-400 border-red-500/20" 
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    )}>
                      {selectedTransaction.is_debit ? "Debit / Outflow" : "Credit / Inflow"}
                    </span>
                  </div>

                  <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-900 space-y-4">
                    {/* Amount & Channel */}
                    <div className="flex justify-between items-center">
                      <p className="text-xl font-black text-slate-100 font-mono">
                        {selectedTransaction.is_debit ? "-" : "+"}{formatINR(selectedTransaction.amount)}
                      </p>
                      <span className="text-[10px] bg-slate-950 border border-slate-850 px-2.5 py-1 rounded font-black tracking-wider uppercase text-slate-300">
                        {selectedTransaction.channel}
                      </span>
                    </div>

                    {/* Sender -> Receiver */}
                    <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded border border-slate-900/60">
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] uppercase text-slate-550 font-bold block">Source Account</span>
                        <p className="font-mono text-xs text-slate-300 truncate" title={selectedTransaction.sender_account}>
                          {isViewer ? maskAccount(selectedTransaction.sender_account) : selectedTransaction.sender_account}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-slate-700 shrink-0" />
                      <div className="flex-1 min-w-0 text-right">
                        <span className="text-[8px] uppercase text-slate-550 font-bold block">Destination</span>
                        <p className="font-mono text-xs text-slate-300 truncate" title={selectedTransaction.receiver_account}>
                          {isViewer ? maskAccount(selectedTransaction.receiver_account) : selectedTransaction.receiver_account}
                        </p>
                      </div>
                    </div>

                    {/* Description narration */}
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Cleaned Narration</span>
                      <p className="bg-slate-950/80 border border-slate-900 p-3 rounded-lg font-mono text-[11px] leading-relaxed text-slate-200 select-all whitespace-pre-wrap break-words">
                        {selectedTransaction.description}
                      </p>
                    </div>

                    {selectedTransaction.raw_description && selectedTransaction.raw_description !== selectedTransaction.description && (
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase text-slate-550 font-bold block">Original Narration</span>
                        <p className="font-mono text-[10px] text-slate-500 break-words">
                          {selectedTransaction.raw_description}
                        </p>
                      </div>
                    )}

                    {/* Date / Time */}
                    <div className="flex justify-between text-[11px] pt-1 text-slate-400">
                      <span>Transaction Date</span>
                      <span className="font-mono font-bold text-slate-300">
                        {new Date(selectedTransaction.timestamp || selectedTransaction.date).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Extracted Entities */}
              {(entities.upi_ids.length > 0 || entities.ifsc_codes.length > 0 || entities.names.length > 0 || entities.merchants.length > 0 || entities.account_numbers.length > 0) && (
                <section className="space-y-2.5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Extracted Signatures</h3>
                  <div className="bg-slate-900/20 border border-slate-900 rounded-xl p-4 space-y-3.5">
                    {/* Names */}
                    {entities.names.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase text-slate-500 font-bold block">Extracted Names</span>
                        <div className="flex flex-wrap gap-1.5">
                          {entities.names.map((val, i) => (
                            <span key={i} className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium font-mono">
                              <User size={10} className="text-indigo-400" /> {val}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* UPI IDs */}
                    {entities.upi_ids.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase text-slate-500 font-bold block">UPI Identifiers</span>
                        <div className="flex flex-wrap gap-1.5">
                          {entities.upi_ids.map((val, i) => (
                            <span key={i} className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium font-mono select-all">
                              <Globe size={10} className="text-indigo-400" /> {val}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* IFSC codes */}
                    {entities.ifsc_codes.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase text-slate-500 font-bold block">IFSC Signatures</span>
                        <div className="flex flex-wrap gap-1.5">
                          {entities.ifsc_codes.map((val, i) => (
                            <span key={i} className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium font-mono select-all">
                              <Landmark size={10} className="text-indigo-400" /> {val}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Merchants */}
                    {entities.merchants.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase text-slate-500 font-bold block">Merchant Entities</span>
                        <div className="flex flex-wrap gap-1.5">
                          {entities.merchants.map((val, i) => (
                            <span key={i} className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium font-mono">
                              <Building size={10} className="text-indigo-400" /> {val}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Account numbers */}
                    {entities.account_numbers.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase text-slate-500 font-bold block">Account Numbers</span>
                        <div className="flex flex-wrap gap-1.5">
                          {entities.account_numbers.map((val, i) => (
                            <span key={i} className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium font-mono select-all">
                              <CreditCard size={10} className="text-indigo-400" /> {val}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Related Patterns */}
              {relatedPatterns.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Triggered Patterns</h3>
                  <div className="space-y-2">
                    {relatedPatterns.map((pat, idx) => (
                      <div key={idx} className="bg-red-950/10 border border-red-500/20 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[11px] text-slate-200 flex items-center gap-1">
                            <ShieldAlert size={12} className="text-red-400" /> {pat.name}
                          </span>
                          <span className="text-[8px] uppercase font-black px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/25">
                            {pat.severity}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-400">
                          {pat.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Mini Chronological Timeline */}
              {miniTimeline.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Chronological Flow</h3>
                  <div className="relative pl-4 space-y-3 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-900">
                    {miniTimeline.map((tx, idx) => {
                      const isCurrent = tx.tx_id === selectedTransaction.tx_id;
                      return (
                        <div 
                          key={tx.tx_id} 
                          onClick={() => onTxSelect && onTxSelect(tx)}
                          className={twMerge(
                            "relative p-3 rounded-lg border text-[11px] transition-all cursor-pointer",
                            isCurrent 
                              ? "bg-indigo-950/20 border-indigo-500/35 hover:bg-indigo-950/30" 
                              : "bg-slate-900/30 border-slate-900 hover:border-slate-800 hover:bg-slate-900/50"
                          )}
                        >
                          {/* Dot indicator */}
                          <span className={twMerge(
                            "absolute -left-5 top-4 w-2 h-2 rounded-full border bg-slate-950",
                            isCurrent ? "border-indigo-500 bg-indigo-500 scale-110" : "border-slate-800"
                          )} />

                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(tx.timestamp || tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={twMerge(
                              "font-black font-mono",
                              tx.is_debit ? "text-red-400" : "text-emerald-400"
                            )}>
                              {tx.is_debit ? "-" : "+"}{formatINR(tx.amount)}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-200 truncate mt-1 select-none">
                            {tx.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Factor Breakdown */}
              {selectedTransaction?.risk_factors && (
                <section>
                  <FactorBreakdown factors={selectedTransaction.risk_factors} />
                </section>
              )}

            </div>

            {/* Action Footer */}
            <footer className="sticky bottom-0 z-10 bg-slate-950 border-t border-slate-900 p-4 flex gap-3 shrink-0">
              <button
                onClick={handleViewInGraph}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs transition-all text-center flex items-center justify-center gap-1.5"
              >
                <GitBranch size={12} />
                View in Money Flow Graph
              </button>
              <button
                onClick={onClose}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-450 hover:text-slate-350 font-bold py-2 px-4 rounded-lg text-xs transition-all"
              >
                Close Panel
              </button>
            </footer>

          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestigationSidebar;
