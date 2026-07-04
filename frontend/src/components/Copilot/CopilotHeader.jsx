import React from 'react';
import { Minus, X, Cpu } from 'lucide-react';

export default function CopilotHeader({ status, onMinimize, onClose }) {
  const getStatusIndicator = () => {
    switch (status) {
      case 'online':
        return <span className="sentinel-header-status text-emerald-400">🟢 Online</span>;
      case 'loading':
        return <span className="sentinel-header-status text-amber-400">🟡 Loading</span>;
      case 'offline':
      default:
        return <span className="sentinel-header-status text-red-500">🔴 Offline</span>;
    }
  };

  return (
    <div className="sentinel-header">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 bg-red-950/40 border border-red-900/30 rounded flex items-center justify-center text-red-500 shadow-sm shadow-red-900/10">
          <Cpu size={12} className="animate-pulse" />
        </div>
        <div className="sentinel-header-title">
          <h3>SENTINEL AI</h3>
          <span>Investigation Copilot</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {getStatusIndicator()}
        <div className="sentinel-header-btns">
          <button 
            onClick={onMinimize} 
            className="sentinel-header-btn"
            title="Minimize"
            aria-label="Minimize Copilot Window"
          >
            <Minus size={13} />
          </button>
          <button 
            onClick={onClose} 
            className="sentinel-header-btn"
            title="Close"
            aria-label="Close Copilot Window"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
