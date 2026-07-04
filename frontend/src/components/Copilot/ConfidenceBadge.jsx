import React from 'react';

export default function ConfidenceBadge({ score }) {
  // Determine color class based on score
  const getConfClass = (val) => {
    if (val >= 85) return 'high';
    if (val >= 60) return 'medium';
    return 'low';
  };

  const confClass = getConfClass(score);

  return (
    <div className="sentinel-confidence-container">
      <div className="sentinel-confidence-header">
        <span className="text-[9px] uppercase tracking-wider text-slate-400">Confidence Metric</span>
        <span className={`sentinel-confidence-score font-mono conf-${confClass}`}>
          {score}% ({confClass.toUpperCase()})
        </span>
      </div>
      <div className="sentinel-confidence-bar-bg" aria-valuenow={score} aria-valuemin="0" aria-valuemax="100">
        <div 
          className={`sentinel-confidence-bar-fill bg-conf-${confClass}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
