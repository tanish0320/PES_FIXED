import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

export default function CopilotInput({ value, onChange, onSend, disabled }) {
  const textareaRef = useRef(null);

  // Auto-resize handler
  useEffect(() => {
    const area = textareaRef.current;
    if (area) {
      area.style.height = 'auto';
      // Cap at scrollHeight, CSS will handle overflow
      area.style.height = `${Math.min(area.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="sentinel-input-form">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about this investigation..."
        className="sentinel-textarea"
        disabled={disabled}
        aria-label="Ask Copilot query input"
      />
      <button 
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="sentinel-send-btn"
        title="Send query"
        aria-label="Send message button"
      >
        <Send size={13} />
      </button>
    </div>
  );
}
