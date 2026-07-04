import React, { useState, useEffect, useRef } from 'react';
import { useCopilot } from './CopilotContext';
import { 
  Sparkles, Send, X, RefreshCw, MessageSquare, ChevronDown, 
  Brain, ShieldAlert, CheckCircle, ArrowRight, Activity, Terminal
} from 'lucide-react';
import './CopilotPopup.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function CopilotPopup() {
  const {
    currentInvestigation,
    currentPage,
    selectedGraphNode,
    selectedTransaction,
    currentReport,
    filters
  } = useCopilot();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      structured: true,
      data: {
        answer: "Hello Officer. I am the SENTINEL AI Investigation Copilot. I can assist you in analyzing transactions, tracing money flow, and auditing reports.",
        evidence: [],
        confidence: 100,
        sources: ["Sentinel Core API"],
        suggested_actions: ["Select an investigation case to begin context auditing."],
        follow_up_questions: [
          "Why is this account suspicious?",
          "Trace money flow in the graph.",
          "Summarize this investigation."
        ]
      }
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamText, isOpen]);

  // Clear chat memory
  const handleResetChat = () => {
    if (window.confirm("Clear Copilot chat memory for this investigation?")) {
      setMessages([
        {
          sender: 'assistant',
          structured: true,
          data: {
            answer: `Memory cleared. Ready for your questions on Case **${currentInvestigation || 'general'}**.`,
            evidence: [],
            confidence: 100,
            sources: ["Sentinel System Reset"],
            suggested_actions: [],
            follow_up_questions: getPageSuggestions()
          }
        }
      ]);
      setStreamText('');
      setIsStreaming(false);
    }
  };

  // Get dynamic page suggested prompts
  const getPageSuggestions = () => {
    if (currentPage === 'graph') {
      const nodeLabel = selectedGraphNode ? `account ${selectedGraphNode}` : "selected account";
      return [
        `Why is ${nodeLabel} suspicious?`,
        "Trace money flow",
        "Summarize graph"
      ];
    } else if (currentPage === 'report') {
      return [
        "Summarize report",
        "Generate FIR summary",
        "Explain investigation"
      ];
    } else {
      return [
        "Highest risk investigation",
        "Show suspicious entities"
      ];
    }
  };

  // Submit Message to FastAPI Streaming endpoint
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || isStreaming) return;

    // Append User Message
    const updatedMessages = [...messages, { sender: 'user', text: text }];
    setMessages(updatedMessages);
    setInputText('');
    setIsStreaming(true);
    setStreamText('');

    try {
      const payload = {
        message: text,
        case_id: currentInvestigation,
        selected_node: selectedGraphNode,
        page: currentPage,
        filters: filters || {}
      };

      const response = await fetch(`${API_BASE}/api/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned code ${response.status}`);
      }

      // Stream handling for JSON lines (NDJSON)
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finalData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'token') {
              setStreamText(prev => prev + parsed.delta);
            } else if (parsed.type === 'final') {
              finalData = parsed.data;
            }
          } catch (e) {
            console.warn("Failed to parse JSON line chunk:", e, line);
          }
        }
      }

      if (finalData) {
        setMessages([...updatedMessages, { sender: 'assistant', structured: true, data: finalData }]);
      } else {
        // Fallback if final metadata block was missing
        setMessages([
          ...updatedMessages,
          { 
            sender: 'assistant', 
            structured: true,
            data: {
              answer: streamText || "Response finished but structured data was unavailable.",
              evidence: [],
              confidence: 70,
              sources: ["Stream Accumulator"],
              suggested_actions: [],
              follow_up_questions: getPageSuggestions()
            }
          }
        ]);
      }
      setStreamText('');
    } catch (err) {
      console.error("Copilot Error:", err);
      setMessages([
        ...updatedMessages,
        { 
          sender: 'assistant', 
          structured: true,
          data: {
            answer: "**AI Copilot Offline**\n\nCould not fetch response from the copilot server. Please ensure that the SENTINEL backend is running at `http://localhost:8000` and Ollama is online with model `qwen3:8b`.",
            evidence: [],
            confidence: 0,
            sources: ["System Error Connection Handler"],
            suggested_actions: ["Verify backend server status.", "Ensure local Ollama service is running."],
            follow_up_questions: ["Try checking another case.", "Ensure Ollama is running."]
          }
        }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Custom Inline Markdown + Table Renderer
  const renderMarkdown = (text) => {
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
      // Bold **text**
      let parts = txt.split(/(\*\*.*?\*\*)/g);
      let elements = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="text-white font-extrabold">{part.slice(2, -2)}</strong>;
        }
        
        // Inline code `code`
        let codeParts = part.split(/(`.*?`)/g);
        return codeParts.map((subpart, subIdx) => {
          if (subpart.startsWith('`') && subpart.endsWith('`')) {
            return <code key={subIdx} className="bg-slate-900 border border-slate-800 text-indigo-300 font-mono text-[10px] px-1 py-0.5 rounded">{subpart.slice(1, -1)}</code>;
          }
          return subpart;
        });
      });
      return elements;
    };

    const flushList = (key) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${key}`} className="list-disc pl-5 space-y-1 my-2">
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
      const lineTrim = line.strip ? line.strip() : line.trim();

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

      // Tables detection
      if (lineTrim.startsWith('|') && lineTrim.endsWith('|')) {
        flushList(i);
        inTable = true;
        // Split by pipe and filter empty
        const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        // Skip separator row |---|---|
        if (!cells.every(c => c.startsWith('-') || c.startsWith(':'))) {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable(i);
      }

      // List detection
      if (lineTrim.startsWith('-') || lineTrim.startsWith('*')) {
        inList = true;
        const cleaned = lineTrim.slice(1).trim();
        listItems.push(<li key={`li-${i}`}>{parseInlineStyles(cleaned)}</li>);
        continue;
      } else if (inList) {
        flushList(i);
      }

      // Paragraph elements
      if (lineTrim === "") {
        continue;
      }

      // Add as regular line
      elements.push(<p key={i} className="mb-2 leading-relaxed">{parseInlineStyles(line)}</p>);
    }

    // Flush any remaining active blocks
    flushList('final');
    flushTable('final');
    flushCodeBlock('final');

    return elements;
  };

  // Determine starting prompts/suggestions
  const lastMessage = messages[messages.length - 1];
  const activeSuggestions = isStreaming 
    ? [] 
    : (lastMessage && lastMessage.structured && lastMessage.data?.follow_up_questions?.length > 0 
        ? lastMessage.data.follow_up_questions 
        : getPageSuggestions());

  return (
    <div className="sentinel-copilot-wrapper">
      
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`sentinel-copilot-trigger ${isOpen ? 'active' : ''}`}
      >
        {isOpen ? <ChevronDown size={24} /> : <Sparkles size={24} className="animate-pulse" />}
      </button>

      {/* Persistent Glassmorphism Popup window */}
      {isOpen && (
        <div className="sentinel-copilot-window">
          
          {/* Header */}
          <div className="sentinel-copilot-header">
            <div className="sentinel-copilot-header-title">
              <div className="h-6 w-6 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-xs">
                🤖
              </div>
              <div>
                <h3>SENTINEL Copilot</h3>
                <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider block">
                  AI Forensic Partner
                </span>
              </div>
            </div>
            
            <div className="sentinel-copilot-header-actions">
              <button 
                onClick={handleResetChat} 
                className="sentinel-copilot-header-btn"
                title="Clear Chat Memory"
              >
                <RefreshCw size={14} />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="sentinel-copilot-header-btn"
                title="Collapse Panel"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Context Tag Banner */}
          <div className="sentinel-copilot-context-banner">
            <span className="text-slate-500 uppercase tracking-widest text-[8px] font-black mr-1">Context:</span>
            <span className="sentinel-context-tag">Page: {currentPage}</span>
            {currentInvestigation && <span className="sentinel-context-tag">Case: {currentInvestigation}</span>}
            {selectedGraphNode && <span className="sentinel-context-tag sentinel-context-tag active-node">Node: {selectedGraphNode}</span>}
          </div>

          {/* Messages Feed */}
          <div className="sentinel-copilot-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`sentinel-message-row ${msg.sender}`}>
                <div className="sentinel-message-avatar">
                  {msg.sender === 'user' ? '👤' : '🤖'}
                </div>
                <div className="sentinel-message-bubble sentinel-copilot-markdown">
                  {msg.structured ? (
                    <div className="space-y-3">
                      
                      {/* Answer block */}
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 mt-1">
                          <Brain size={12} className="text-indigo-400" /> Answer
                        </h3>
                        <div className="text-slate-100 text-xs mt-1">
                          {renderMarkdown(msg.data.answer)}
                        </div>
                      </div>

                      {/* Evidence block */}
                      {msg.data.evidence && msg.data.evidence.length > 0 && (
                        <div className="space-y-1">
                          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldAlert size={12} className="text-amber-500" /> Evidence
                          </h3>
                          <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-300 text-xs">
                            {msg.data.evidence.map((ev, idx) => (
                              <li key={idx}>{ev}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Confidence block */}
                      {msg.data.confidence !== undefined && (
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                            <CheckCircle size={12} className="text-emerald-500" /> Confidence
                          </h3>
                          <span className="sentinel-confidence-score font-mono text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                            {msg.data.confidence}%
                          </span>
                        </div>
                      )}

                      {/* Suggested Actions block */}
                      {msg.data.suggested_actions && msg.data.suggested_actions.length > 0 && (
                        <div className="space-y-1">
                          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity size={12} className="text-indigo-400" /> Suggested Actions
                          </h3>
                          <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-300 text-xs font-bold">
                            {msg.data.suggested_actions.map((act, idx) => (
                              <li key={idx} className="text-indigo-300">{act}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sources block */}
                      {msg.data.sources && msg.data.sources.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-800/40">
                          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <ArrowRight size={10} className="text-slate-500" /> Sources
                          </h3>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {msg.data.sources.map((src, idx) => (
                              <span key={idx} className="bg-slate-900/60 border border-slate-850 px-1.5 py-0.5 rounded text-[9px] text-slate-400 font-mono">
                                {src}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    // Regular text message (User messages)
                    <div>{msg.text}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Token Stream Container */}
            {isStreaming && streamText && (
              <div className="sentinel-message-row assistant">
                <div className="sentinel-message-avatar">
                  🤖
                </div>
                <div className="sentinel-message-bubble sentinel-copilot-markdown">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 mt-1">
                      <Brain size={12} className="text-indigo-400" /> Answer
                    </h3>
                    <div className="text-slate-100 text-xs mt-1">
                      {renderMarkdown(streamText)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Typing status dots */}
            {isStreaming && !streamText && (
              <div className="sentinel-message-row assistant">
                <div className="sentinel-message-avatar">
                  🤖
                </div>
                <div className="sentinel-message-bubble">
                  <div className="sentinel-typing-indicator">
                    <span className="sentinel-typing-dot"></span>
                    <span className="sentinel-typing-dot"></span>
                    <span className="sentinel-typing-dot"></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Action Suggestions */}
          {activeSuggestions.length > 0 && (
            <div className="sentinel-copilot-suggested">
              <span className="sentinel-suggested-title">Suggested Inquiries</span>
              <div className="sentinel-suggested-list">
                {activeSuggestions.map((q, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => handleSendMessage(q)}
                    className="sentinel-suggested-btn"
                  >
                    <span>{q}</span>
                    <MessageSquare size={10} className="text-slate-600 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Control Input form */}
          <div className="sentinel-copilot-input-form">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Copilot about statements, risk or graph..."
              className="sentinel-copilot-input"
              disabled={isStreaming}
            />
            <button 
              onClick={() => handleSendMessage()}
              disabled={isStreaming || !inputText.trim()}
              className="sentinel-copilot-send-btn"
            >
              <Send size={14} />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
