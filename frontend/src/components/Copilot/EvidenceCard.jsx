import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

export default function EvidenceCard({ text, caseId }) {
  const navigate = useNavigate();

  // Parse details using regex
  const txIdMatch = text.match(/\b(TX-\w+)\b/i);
  const amountMatch = text.match(/(₹[\d,]+|Rs\.?\s*[\d,]+)/i);
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  
  const channels = ["UPI", "IMPS", "NEFT", "RTGS", "CASH", "TRANSFER"];
  let detectedChannel = "TRANSFER";
  for (const ch of channels) {
    if (text.toUpperCase().includes(ch)) {
      detectedChannel = ch;
      break;
    }
  }

  const txId = txIdMatch ? txIdMatch[1].toUpperCase() : null;
  const amount = amountMatch ? amountMatch[1] : null;
  const date = dateMatch ? dateMatch[1] : null;

  // Clean description text (strip out parts already displayed)
  let description = text;
  if (txId) description = description.replace(txIdMatch[0], '');
  if (amount) description = description.replace(amountMatch[0], '');
  if (date) description = description.replace(dateMatch[0], '');
  // Clean up separators | and leading/trailing whitespace
  description = description.replace(/[|\-\s,]+/g, ' ').trim();

  // Navigation click
  const handleOpenClick = () => {
    if (caseId) {
      navigate(`/graph/${caseId}`);
    } else {
      navigate('/transactions');
    }
  };

  if (!txId) {
    // If it's a general text statement without a transaction code, render as generic evidence card
    return (
      <div className="sentinel-evidence-card">
        <div className="sentinel-evidence-info">
          <span className="sentinel-evidence-txid text-amber-500 uppercase tracking-widest text-[9px]">General Audit Fact</span>
          <span className="text-xs text-slate-300 font-semibold">{text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sentinel-evidence-card" aria-label={`Evidence Transaction ${txId}`}>
      <div className="sentinel-evidence-info">
        <div className="flex items-center gap-2">
          <span className="sentinel-evidence-txid">{txId}</span>
          <span className="text-[8px] bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-indigo-400 font-bold uppercase">
            {detectedChannel}
          </span>
        </div>
        <span className="sentinel-evidence-details">
          {date && `Date: ${date}`} {description && `| ${description}`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {amount && <span className="sentinel-evidence-amount font-mono">{amount}</span>}
        <button 
          onClick={handleOpenClick}
          className="sentinel-evidence-btn flex items-center gap-1"
          title="Analyze transaction in Graph view"
        >
          <span>Open</span> <ExternalLink size={10} />
        </button>
      </div>
    </div>
  );
}
