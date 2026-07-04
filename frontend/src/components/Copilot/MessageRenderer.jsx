import React from 'react';
import { Terminal } from 'lucide-react';

export default function MessageRenderer({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let tableRows = [];
  let inList = false;
  let inTable = false;
  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeBlockLang = '';

  const parseInlineStyles = (txt) => {
    // Bold: **text**
    let parts = txt.split(/(\*\*.*?\*\*)/g);
    let elements = parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-white font-extrabold">{part.slice(2, -2)}</strong>;
      }
      
      // Italic: *text*
      let italicParts = part.split(/(\*.*?\*)/g);
      return italicParts.map((subpart, subIdx) => {
        if (subpart.startsWith('*') && subpart.endsWith('*')) {
          return <em key={subIdx} className="text-slate-200 italic font-semibold">{subpart.slice(1, -1)}</em>;
        }

        // Inline Code: `code`
        let codeParts = subpart.split(/(`.*?`)/g);
        return codeParts.map((inlinePart, inlineIdx) => {
          if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
            return (
              <code key={inlineIdx} className="bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-[10px] px-1 py-0.5 rounded">
                {inlinePart.slice(1, -1)}
              </code>
            );
          }
          return inlinePart;
        });
      });
    });
    return elements;
  };

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="sentinel-md-ul list-disc pl-5 my-2">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key) => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const bodyRows = tableRows.slice(1);
      
      elements.push(
        <div key={`table-${key}`} className="overflow-x-auto my-3 border border-slate-800 rounded-lg">
          <table className="min-w-full divide-y divide-slate-800 text-[11px]">
            <thead className="bg-slate-900/60">
              <tr>
                {headerRow.map((cell, idx) => (
                  <th key={idx} className="px-3 py-2 text-left font-black text-slate-300 uppercase tracking-wider">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-950/20">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-900/30">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 font-semibold text-slate-300">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  const flushCodeBlock = (key) => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <div key={`code-${key}`} className="my-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-950/80">
          <div className="bg-slate-900 px-3 py-1 text-[9px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-850">
            <Terminal size={10} /> {codeBlockLang || 'code'}
          </div>
          <pre className="p-3 text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        </div>
      );
      codeBlockLines = [];
      inCodeBlock = false;
      codeBlockLang = '';
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTrim = line.trim();

    // Code Block Toggles
    if (lineTrim.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock(i);
      } else {
        flushList(i);
        flushTable(i);
        inCodeBlock = true;
        codeBlockLang = lineTrim.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Blockquote: > text
    if (lineTrim.startsWith('>')) {
      flushList(i);
      flushTable(i);
      const cleanedQuote = lineTrim.slice(1).trim();
      elements.push(
        <blockquote key={i} className="sentinel-md-blockquote">
          {parseInlineStyles(cleanedQuote)}
        </blockquote>
      );
      continue;
    }

    // Tables: | cell | cell |
    if (lineTrim.startsWith('|') && lineTrim.endsWith('|')) {
      flushList(i);
      inTable = true;
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Skip alignment line e.g. |---|---|
      if (!cells.every(c => c.startsWith('-') || c.startsWith(':'))) {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    // Unordered Lists: - item or * item
    if (lineTrim.startsWith('-') || lineTrim.startsWith('*')) {
      inList = true;
      const cleaned = lineTrim.slice(1).trim();
      listItems.push(<li key={`li-${i}`} className="sentinel-md-li">{parseInlineStyles(cleaned)}</li>);
      continue;
    } else if (inList) {
      flushList(i);
    }

    if (lineTrim === "") {
      continue;
    }

    elements.push(
      <p key={i} className="sentinel-md-p">
        {parseInlineStyles(line)}
      </p>
    );
  }

  // Flush remaining elements
  flushList('final');
  flushTable('final');
  flushCodeBlock('final');

  return <div className="sentinel-markdown-body">{elements}</div>;
}
