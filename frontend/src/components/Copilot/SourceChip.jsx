import React from 'react';

export default function SourceChip({ text }) {
  return (
    <span className="sentinel-source-chip" title={`Source: ${text}`}>
      {text}
    </span>
  );
}
