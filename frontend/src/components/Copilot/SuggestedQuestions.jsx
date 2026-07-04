import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function SuggestedQuestions({ questions, onSelect }) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="sentinel-suggested-container">
      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-extrabold block pl-1">
        Suggested Inquiries
      </span>
      <div className="sentinel-suggested-list">
        {questions.map((q, idx) => (
          <button 
            key={idx}
            onClick={() => onSelect(q)}
            className="sentinel-suggested-chip group"
            title={`Ask: "${q}"`}
          >
            <span>{q}</span>
            <MessageSquare size={10} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
