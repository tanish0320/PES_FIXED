import React, { useEffect, useState, useRef } from 'react';
import { useCopilot } from '../CopilotContext';
import CopilotHeader from './CopilotHeader';
import CopilotInput from './CopilotInput';
import CopilotMessage from './CopilotMessage';
import SuggestedQuestions from './SuggestedQuestions';
import TypingIndicator from './TypingIndicator';
import { routeAndExecute } from '../../copilot/intentRouter';
import { Sparkles, MessageSquare, AlertCircle } from 'lucide-react';
import './Copilot.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function CopilotPopup() {
  const {
    isOpen,
    setIsOpen,
    messages,
    setMessages,
    loading,
    setLoading,
    streaming,
    setStreaming,
    selectedNode,
    selectedTransaction,
    selectedCase,
    setSelectedCase,
    currentPage,
    currentFilters,
    toolHandlers,
    currentTimeline,
    graphState,
    dashboardStats
  } = useCopilot();

  const [inputText, setInputText] = useState('');
  const [streamText, setStreamText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('offline'); // online, loading, offline
  const [autoScroll, setAutoScroll] = useState(true);
  const [closing, setClosing] = useState(false);

  const messagesContainerRef = useRef(null);

  // 1. Keyboard shortcuts: Ctrl + Shift + A to toggle, Esc to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'A') {
        e.preventDefault();
        handleToggle();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 2. Health check on mount & periodically
  const runHealthCheck = async () => {
    setConnectionStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/copilot/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'healthy') {
          setConnectionStatus('online');
          return;
        }
      }
      setConnectionStatus('offline');
    } catch {
      setConnectionStatus('offline');
    }
  };

  useEffect(() => {
    runHealthCheck();
    const interval = setInterval(runHealthCheck, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  // 3. Scroll position tracking: Pause auto-scroll if user scrolls up
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 25;
    setAutoScroll(isAtBottom);
  };

  useEffect(() => {
    if (autoScroll && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, streamText, isOpen, autoScroll]);

  // 4. Opening & Closing animation controllers
  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      setIsOpen(true);
      setAutoScroll(true);
    }
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setClosing(false);
    }, 200); // match close animation duration
  };

  // 5. Dynamic page suggested prompt triggers
  const getPageSuggestions = () => {
    if (currentPage === 'graph') {
      const nodeLabel = selectedNode ? `account ${selectedNode}` : "this node";
      return [
        `Why is ${nodeLabel} suspicious?`,
        "Trace money flow",
        "Explain this node",
        "Find connected entities"
      ];
    } else if (currentPage === 'report') {
      return [
        "Summarize report",
        "Generate FIR summary",
        "Explain risk score"
      ];
    } else if (currentPage === 'dashboard') {
      return [
        "Highest risk investigation",
        "Recent suspicious activity",
        "Pattern summary"
      ];
    }
    return [
      "Explain this investigation",
      "Why is this suspicious?",
      "Summarize report",
      "Trace money flow"
    ];
  };

  // 6. Send payload to Backend & parse NDJSON stream
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || streaming || loading) return;

    // Append user bubble
    const userMsg = { sender: 'user', text: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);
    setStreaming(true);
    setStreamText('Analyzing graph...');
    setAutoScroll(true);

    // Setup active context helper object
    const copilotContext = {
      isOpen, setIsOpen, messages, setMessages, loading, setLoading,
      streaming, setStreaming, selectedNode, selectedTransaction,
      selectedCase, setSelectedCase, currentPage, currentFilters, toolHandlers,
      currentTimeline, graphState, dashboardStats
    };

    // Cyclical status message simulation
    const progressMessages = [
      "Analyzing graph...",
      "Checking transactions...",
      "Reviewing investigation...",
      "Finding evidence...",
      "Preparing response..."
    ];
    let msgIdx = 0;
    const progressInterval = setInterval(() => {
      if (msgIdx < progressMessages.length - 1) {
        msgIdx++;
        setStreamText(progressMessages[msgIdx]);
      }
    }, 1200);

    // Check if handled by direct client-side tool execution
    setTimeout(async () => {
      try {
        // 1. Try running client-side tool routing
        try {
          const toolResponse = routeAndExecute(text, copilotContext);
          if (toolResponse) {
            clearInterval(progressInterval);
            setMessages([...updatedMessages, toolResponse]);
            setLoading(false);
            setStreaming(false);
            setStreamText('');
            return;
          }
        } catch (err) {
          console.warn("Client-side tool execution failed:", err);
        }

        // 2. Fallback to Ollama backend API
        const payload = {
          message: text,
          case_id: selectedCase,
          selected_node: selectedNode,
          page: currentPage,
          filters: currentFilters || {}
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
                clearInterval(progressInterval);
                setStreamText(prev => prev === 'Analyzing graph...' ? parsed.delta : prev + parsed.delta);
              } else if (parsed.type === 'final') {
                finalData = parsed.data;
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message || "Model failed");
              }
            } catch (e) {
              console.warn("Failed to parse JSON stream chunk:", e, line);
            }
          }
        }

        clearInterval(progressInterval); // Ensure progress interval is cleared

        if (finalData) {
          setMessages([...updatedMessages, { sender: 'assistant', structured: true, data: finalData }]);
        } else {
          // Fallback
          setMessages([
            ...updatedMessages,
            {
              sender: 'assistant',
              structured: true,
              data: {
                answer: streamText || "Forensic analysis completed.",
                evidence: [],
                confidence: 70,
                sources: ["Sentinel System Stream"],
                suggested_actions: [],
                follow_up_questions: getPageSuggestions()
              }
            }
          ]);
        }
      } catch (err) {
        clearInterval(progressInterval);
        console.error("Copilot streaming failed:", err);
        setMessages([
          ...updatedMessages,
          {
            sender: 'assistant',
            structured: true,
            data: {
              answer: "**AI Copilot Offline**\n\nUnable to connect to local Qwen model. Please verify Ollama is pulled and running locally.",
              evidence: [],
              confidence: 0,
              sources: ["System Error Boundary"],
              suggested_actions: [],
              follow_up_questions: ["Retry health check", "Reload dashboard"]
            }
          }
        ]);
      } finally {
        setLoading(false);
        setStreaming(false);
        setStreamText('');
      }
    }, 100);
  };

  const handleSuggestionSelect = (q) => {
    if (q === "Retry health check") {
      runHealthCheck();
    } else {
      handleSendMessage(q);
    }
  };

  // Determine active suggestions
  const lastMessage = messages[messages.length - 1];
  const activeSuggestions = (streaming || loading) 
    ? [] 
    : (lastMessage && lastMessage.structured && lastMessage.data?.follow_up_questions?.length > 0 
        ? lastMessage.data.follow_up_questions 
        : getPageSuggestions());

  return (
    <div className="sentinel-copilot-wrapper">
      
      {/* 1. Floating Bubble Toggle */}
      <button 
        onClick={handleToggle}
        className={`sentinel-copilot-trigger ${isOpen ? 'active' : ''}`}
        title="Toggle SENTINEL AI Copilot (Ctrl+Shift+A)"
        aria-label="Toggle SENTINEL AI Copilot button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Sparkles size={24} className="animate-pulse" />
      </button>

      {/* 2. Persistent Floating Window */}
      {isOpen && (
        <div className={`sentinel-copilot-window ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label="SENTINEL AI Copilot Interface">
          
          <CopilotHeader 
            status={connectionStatus} 
            onMinimize={handleClose} 
            onClose={handleClose} 
          />

          {/* Messages Feed */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="sentinel-messages-container"
          >
            {messages.length === 0 ? (
              <div className="sentinel-empty-state">
                <div className="sentinel-empty-icon">
                  <Sparkles size={24} />
                </div>
                <h4>Welcome to SENTINEL AI</h4>
                <p>
                  I can help explain investigations, analyse suspicious accounts, trace money movement and summarize reports.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <CopilotMessage key={index} message={msg} />
              ))
            )}

            {/* Token Stream UI bubble */}
            {streaming && streamText && (
              <CopilotMessage 
                message={{ sender: 'assistant', text: streamText }} 
                isStreamingCursor={true} 
              />
            )}

            {/* Typing bouncing dots */}
            {loading && !streamText && (
              <div className="sentinel-msg-row assistant">
                <div className="sentinel-msg-avatar">AI</div>
                <div className="sentinel-msg-bubble">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>

          {/* Context Questions */}
          {activeSuggestions.length > 0 && (
            <SuggestedQuestions 
              questions={activeSuggestions} 
              onSelect={handleSuggestionSelect} 
            />
          )}

          {/* Form Control Input */}
          <CopilotInput 
            value={inputText} 
            onChange={setInputText} 
            onSend={() => handleSendMessage()} 
            disabled={loading || streaming} 
          />

        </div>
      )}
    </div>
  );
}
