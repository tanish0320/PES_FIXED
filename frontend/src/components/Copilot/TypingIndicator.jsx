import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="sentinel-typing-indicator" aria-label="Copilot is typing">
      <span className="sentinel-typing-dot"></span>
      <span className="sentinel-typing-dot"></span>
      <span className="sentinel-typing-dot"></span>
    </div>
  );
}
