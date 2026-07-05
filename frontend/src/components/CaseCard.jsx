import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, GitBranch, ShieldAlert, CheckCircle, Percent, Eye } from 'lucide-react';
import RiskBadge from './RiskBadge';
import BorderGlow from './BorderGlow';

const CaseCard = ({ caseData, onAnalyze }) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  if (!caseData) return null;

  const {
    case_id,
    account_id,
    status,
    risk_score,
    risk_level,
    total_transactions,
    total_credits,
    total_debits,
    pattern_count,
    patterns_detected = [],
    parser_confidence,
    source_file
  } = caseData;

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

  const getStatusColor = (s) => {
    if (s === 'HIGH_RISK') return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'ANALYZED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    return 'bg-slate-500/10 text-slate-400 border-slate-550';
  };

  return (
    <BorderGlow
      onClick={() => onAnalyze && onAnalyze(caseData)}
      borderRadius={12}
      glowColor="225 100 65"
      colors={['#3b82f6', '#6366f1', '#a855f7']}
      backgroundColor="#0f172a"
      glowRadius={30}
      glowIntensity={1.3}
      edgeSensitivity={35}
      className="w-full cursor-pointer group"
    >
      <div className="p-5 flex flex-col justify-between h-full w-full">
        <div>
          {/* Top Header */}
          <div className="flex justify-between items-start gap-2 mb-3">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Case Investigation</span>
              <h3 className="text-sm font-bold text-gray-200 font-mono tracking-tight mt-0.5">{case_id}</h3>
            </div>
            <RiskBadge score={risk_score} />
          </div>

          {/* Account Details */}
          <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-3 mb-4 flex justify-between items-center">
            <div>
              <span className="text-[9px] text-slate-500 font-bold uppercase block">Target Account</span>
              <span className="text-xs font-mono font-bold text-gray-100">{account_id}</span>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${getStatusColor(status)}`}>
              {status}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850/50">
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Inflow Volume</span>
              <span className="text-xs font-bold text-emerald-400">{formatINR(total_credits)}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850/50">
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Outflow Volume</span>
              <span className="text-xs font-bold text-red-400">{formatINR(total_debits)}</span>
            </div>
          </div>

          {/* Mid Stats */}
          <div className="space-y-2 mb-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Transactions</span>
              <span className="font-semibold text-gray-200">{total_transactions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1">
                <ShieldAlert size={12} className="text-indigo-400" />
                Patterns Detected
              </span>
              <span className="font-semibold text-gray-200">{pattern_count}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1">
                <Percent size={12} className="text-indigo-400" />
                Parser Confidence
              </span>
              <span className={`font-semibold ${parser_confidence >= 90 ? "text-emerald-400" : "text-amber-400"}`}>
                {parser_confidence}%
              </span>
            </div>
          </div>

          {/* Detected Patterns list (preview) */}
          {patterns_detected.length > 0 && (
            <div className="mb-4 pt-3 border-t border-slate-850">
              <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1.5">Flagged Triggers</span>
              <div className="flex flex-wrap gap-1">
                {patterns_detected.slice(0, 3).map((pat) => (
                  <span key={pat} className="text-[8px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded uppercase">
                    {pat}
                  </span>
                ))}
                {patterns_detected.length > 3 && (
                  <span className="text-[8px] font-bold text-slate-500 px-1 py-0.5">
                    +{patterns_detected.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="pt-3 border-t border-slate-850 flex gap-2 w-full mt-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/graph/${case_id}`);
            }}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-gray-300 font-semibold py-1.5 px-3 rounded-lg text-[10px] transition-all flex items-center justify-center gap-1 border border-slate-750"
          >
            <GitBranch size={10} />
            Graph
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/report/${case_id}`);
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-1.5 px-3 rounded-lg text-[10px] shadow-md transition-all flex items-center justify-center gap-1"
          >
            <FileText size={10} />
            Report
          </button>
        </div>
      </div>
    </BorderGlow>
  );
};

export default CaseCard;
