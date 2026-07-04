import React from 'react';
import MessageRenderer from './MessageRenderer';
import EvidenceCard from './EvidenceCard';
import SourceChip from './SourceChip';
import ConfidenceBadge from './ConfidenceBadge';
import { useCopilot } from '../CopilotContext';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CopilotMessage({ message, isStreamingCursor }) {
  const { selectedCase } = useCopilot();
  const navigate = useNavigate();

  const isOfficer = message.sender === 'user';

  // Handle action button click
  const handleActionClick = (actionName) => {
    const act = actionName.toLowerCase();
    
    if (act.includes("highlight graph")) {
      // Dispatch custom event to notify GraphCanvas to run its highlight animations
      window.dispatchEvent(new CustomEvent('sentinel-highlight-graph'));
    } else if (act.includes("open timeline") || act.includes("timeline")) {
      if (selectedCase) {
        navigate(`/report/${selectedCase}`);
      } else {
        navigate('/transactions');
      }
    } else if (act.includes("open report") || act.includes("report")) {
      if (selectedCase) {
        navigate(`/report/${selectedCase}`);
      } else {
        navigate('/investigations');
      }
    }
  };

  return (
    <div className={`sentinel-msg-row ${isOfficer ? 'officer' : 'assistant'}`}>
      <div className="sentinel-msg-avatar">
        {isOfficer ? 'Analyst' : 'AI'}
      </div>
      <div className="sentinel-msg-bubble">
        {message.structured && message.data ? (
          <div className="space-y-4">
            
            {/* Structured Title Banner */}
            {message.data.title && (
              <div className="border-b border-slate-800 pb-2 mb-2">
                <h4 className="text-white font-extrabold text-sm uppercase tracking-wide flex items-center gap-1.5">
                  🛡️ {message.data.title}
                </h4>
              </div>
            )}

            {/* Answer Paragraph */}
            <div className="space-y-1">
              <span className="sentinel-section-title">Answer</span>
              <div className="text-slate-100 font-medium">
                <MessageRenderer text={message.data.answer || message.data.explanation} />
                {isStreamingCursor && <span className="sentinel-streaming-cursor"></span>}
              </div>
            </div>

            {/* Evidence Cards */}
            {message.data.evidence && message.data.evidence.length > 0 && (
              <div className="space-y-1.5">
                <span className="sentinel-section-title">Evidence</span>
                <div className="sentinel-evidence-container">
                  {message.data.evidence.map((ev, idx) => (
                    <EvidenceCard key={idx} text={ev} caseId={selectedCase} />
                  ))}
                </div>
              </div>
            )}

            {/* Confidence progress */}
            {message.data.confidence !== undefined && (
              <ConfidenceBadge score={message.data.confidence} />
            )}

            {/* Recommendations block */}
            {message.data.recommendations && message.data.recommendations.length > 0 && (
              <div className="space-y-1.5">
                <span className="sentinel-section-title">AI Recommendations</span>
                <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-300 text-xs font-semibold">
                  {message.data.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-indigo-200">{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested Actions */}
            {message.data.suggested_actions && message.data.suggested_actions.length > 0 && (
              <div className="space-y-1.5">
                <span className="sentinel-section-title">Suggested Actions</span>
                <div className="sentinel-actions-container">
                  {message.data.suggested_actions.map((act, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleActionClick(act)}
                      className="sentinel-action-btn"
                    >
                      <Play size={10} className="fill-current" />
                      <span>{act}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sources Citations */}
            {message.data.sources && message.data.sources.length > 0 && (
              <div className="space-y-1 pt-1.5 border-t border-slate-800">
                <span className="sentinel-section-title">Sources</span>
                <div className="sentinel-sources-container">
                  {message.data.sources.map((src, idx) => (
                    <SourceChip key={idx} text={src} />
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          // Plain Text messages (User, streaming, or fallback error)
          <div className="relative">
            <MessageRenderer text={message.text} />
            {isStreamingCursor && <span className="sentinel-streaming-cursor"></span>}
          </div>
        )}
      </div>
    </div>
  );
}
