import React, { useEffect, useState, useRef } from 'react';
import { useCopilot } from '../CopilotContext';
import CopilotHeader from './CopilotHeader';
import CopilotInput from './CopilotInput';
import CopilotMessage from './CopilotMessage';
import SuggestedQuestions from './SuggestedQuestions';
import TypingIndicator from './TypingIndicator';
import { routeAndExecute } from '../../copilot/intentRouter';
import { ReasoningEngine } from '../../copilot/reasoning/ReasoningEngine';
import { InvestigationMonitor } from '../../copilot/monitor/InvestigationMonitor';
import { ReplayEngine } from '../../copilot/replay/ReplayEngine';
import { Sparkles, MessageSquare, AlertCircle, Play } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'audit'

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

    if (text.toLowerCase().includes("narrate") || text.toLowerCase() === "/narrate") {
      handleNarrateInvestigation();
      return;
    }

    if (text.startsWith('/')) {
      const cmd = text.toLowerCase().trim();
      const userMsg = { sender: 'user', text: text };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInputText('');
      
      const copilotContext = {
        isOpen, setIsOpen, messages, setMessages, loading, setLoading,
        streaming, setStreaming, selectedNode, selectedTransaction,
        selectedCase, setSelectedCase, currentPage, currentFilters, toolHandlers,
        currentTimeline, graphState, dashboardStats
      };

      if (cmd === '/summary') {
        const toolResponse = routeAndExecute('summarize investigation', copilotContext);
        setMessages([...updatedMessages, toolResponse]);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/police') {
        const monitorRes = InvestigationMonitor.monitor(copilotContext);
        printPoliceBrief(monitorRes);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/bank') {
        const monitorRes = InvestigationMonitor.monitor(copilotContext);
        printBankBrief(monitorRes);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/demo') {
        handleNarrateInvestigation();
        return;
      }
      if (cmd === '/cycles') {
        const toolResponse = routeAndExecute('circular transfers', copilotContext);
        setMessages([...updatedMessages, toolResponse]);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/layering') {
        const toolResponse = routeAndExecute('highlight suspicious', copilotContext);
        setMessages([...updatedMessages, toolResponse]);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/trace') {
        const toolResponse = routeAndExecute('trace money from ACC-1001', copilotContext);
        setMessages([...updatedMessages, toolResponse]);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/entities') {
        const toolResponse = routeAndExecute('repeated beneficiaries', copilotContext);
        setMessages([...updatedMessages, toolResponse]);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/timeline') {
        const toolResponse = routeAndExecute('summarize timeline', copilotContext);
        setMessages([...updatedMessages, toolResponse]);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/recommend') {
        const toolResponse = routeAndExecute('summarize investigation', copilotContext);
        setMessages([...updatedMessages, toolResponse]);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
      if (cmd === '/help') {
        setMessages([...updatedMessages, {
          sender: 'assistant',
          text: `**SENTINEL AI Copilot Slash Commands**:\n\n* \`/summary\` - Analyze current investigation case\n* \`/demo\` - Start Autonomous Autopilot walkthrough\n* \`/police\` - Export official Police FIR Brief\n* \`/bank\` - Export Bank Audit Brief\n* \`/cycles\` - Highlight circular transactions\n* \`/layering\` - Highlight layering channels\n* \`/trace\` - Trace flow from core node\n* \`/entities\` - Show repeated counterparties\n* \`/timeline\` - Summarize timeline records`
        }]);
        setLoading(false); setStreaming(false); setStreamText('');
        return;
      }
    }

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

  const printPoliceBrief = (analysis) => {
    const printWindow = window.open('', '_blank');
    const dateStr = new Date().toLocaleDateString();
    const volumeStr = new Intl.NumberFormat('en-IN').format(analysis.metrics?.monitoredVolume || 0);

    const html = `
      <html>
      <head>
        <title>SENTINEL AI - First Information Report (FIR) Brief</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 40px; background: white; color: black; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px double black; padding-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; text-transform: uppercase; }
          .section { margin: 30px 0; }
          .section-title { font-size: 16px; font-weight: bold; border-bottom: 1px solid black; padding-bottom: 4px; text-transform: uppercase; }
          .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .table th, .table td { border: 1px solid black; padding: 8px; text-align: left; font-size: 12px; }
          .footer { margin-top: 50px; text-align: right; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">First Information Report Brief</div>
          <div>SENTINEL Financial Crime Intelligence Unit</div>
          <div>Report Date: ${dateStr} | Case ID: ${analysis.caseId || 'UNKNOWN'}</div>
        </div>
        
        <div class="section">
          <div class="section-title">1. Case Overview</div>
          <p>An autonomous forensic audit conducted by SENTINEL AI has flagged suspicious money laundering patterns in Case <strong>${analysis.caseId || 'General'}</strong>. A total monitored volume of <strong>₹${volumeStr}</strong> was evaluated across <strong>${analysis.metrics?.totalAccounts || 0} accounts</strong> and <strong>${analysis.metrics?.totalTransactions || 0} transactions</strong>.</p>
        </div>

        <div class="section">
          <div class="section-title">2. Primary Suspicious Findings</div>
          <ul>
            ${analysis.events?.map(e => `<li><strong>${e.title} (${e.severity})</strong>: ${e.explanation}</li>`).join('') || '<li>No critical anomalies logged.</li>'}
          </ul>
        </div>

        <div class="section">
          <div class="section-title">3. Recommended Law Enforcement Actions</div>
          <ol>
            ${analysis.recommendations?.map(r => `<li>${r}</li>`).join('') || '<li>Standard review.</li>'}
          </ol>
        </div>

        <div class="footer">
          <p>Prepared autonomously by SENTINEL AI Copilot</p>
          <p>Signature: __________________________</p>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printBankBrief = (analysis) => {
    const printWindow = window.open('', '_blank');
    const dateStr = new Date().toLocaleDateString();
    const volumeStr = new Intl.NumberFormat('en-IN').format(analysis.metrics?.monitoredVolume || 0);

    const html = `
      <html>
      <head>
        <title>SENTINEL AI - Bank Investigation Summary</title>
        <style>
          body { font-family: sans-serif; padding: 40px; background: white; color: black; line-height: 1.6; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; color: #1e3a8a; }
          .section { margin: 30px 0; }
          .section-title { font-size: 14px; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase; }
          .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .table th, .table td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
          .table th { background: #f3f4f6; }
          .footer { margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 11px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Bank Audit Investigation Summary</div>
            <div>Security & Fraud Intelligence Group</div>
          </div>
          <div style="text-align: right;">
            <div>Case Reference: ${analysis.caseId || 'General'}</div>
            <div>Generated: ${dateStr}</div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Case Scope</div>
          <p>Monitored transaction flow across <strong>${analysis.metrics?.totalAccounts || 0} participant accounts</strong> totaling <strong>₹${volumeStr}</strong>. Secondary downstream beneficiary audit targets have been identified.</p>
        </div>

        <div class="section">
          <div class="section-title">Flagged Accounts & Routing Conduits</div>
          <table class="table">
            <thead>
              <tr>
                <th>Account/Node ID</th>
                <th>Net Inflow/Outflow</th>
                <th>Suspicion Profile</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Primary Funding Source</td>
                <td>${analysis.analytics?.moneySource?.id || 'N/A'}</td>
                <td>High Net Outflow</td>
              </tr>
              <tr>
                <td>Primary Money Sink</td>
                <td>${analysis.analytics?.moneySink?.id || 'N/A'}</td>
                <td>High Net Inflow Target</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Actionable Directives</div>
          <ul>
            ${analysis.recommendations?.map(r => `<li>${r}</li>`).join('') || '<li>Review transaction history.</li>'}
          </ul>
        </div>

        <div class="footer">
          <p>CONFIDENTIAL | FOR BANK FRAUD AUDIT PURPOSES ONLY</p>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleNextActionClick = (actionType) => {
    if (actionType === "HIGHLIGHT_CIRCULAR") {
      if (toolHandlers.highlightPattern) toolHandlers.highlightPattern("Circular");
      setActiveTab('chat');
      setMessages(prev => [...prev, { sender: 'assistant', text: "Highlighting circular round-tripping flows on Cytoscape canvas." }]);
    } else if (actionType === "HIGHLIGHT_LAYERING") {
      if (toolHandlers.highlightPattern) toolHandlers.highlightPattern("Layering");
      setActiveTab('chat');
      setMessages(prev => [...prev, { sender: 'assistant', text: "Highlighting layering structures on Cytoscape canvas." }]);
    } else if (actionType === "EXPAND_NETWORK") {
      if (toolHandlers.expandNetwork) toolHandlers.expandNetwork("ACC-1001");
      setActiveTab('chat');
      setMessages(prev => [...prev, { sender: 'assistant', text: "Expanding downstream network around core node ACC-1001." }]);
    } else if (actionType === "FILTER_UPI") {
      if (toolHandlers.setFeedFilters) toolHandlers.setFeedFilters({ channel: 'UPI' });
      if (toolHandlers.navigate) toolHandlers.navigate('/transactions');
      setActiveTab('chat');
      setMessages(prev => [...prev, { sender: 'assistant', text: "Navigated to Feed page and filtered by UPI payments." }]);
    } else if (actionType === "HIGHLIGHT_SOURCE") {
      if (toolHandlers.highlightNode) toolHandlers.highlightNode("ACC-1001");
      if (toolHandlers.zoomToNode) toolHandlers.zoomToNode("ACC-1001");
      setActiveTab('chat');
      setMessages(prev => [...prev, { sender: 'assistant', text: "Focused and highlighted core money source ACC-1001." }]);
    } else if (actionType === "ZOOM_HIGHEST") {
      if (toolHandlers.zoomToNode) toolHandlers.zoomToNode("ACC-1004");
      setActiveTab('chat');
      setMessages(prev => [...prev, { sender: 'assistant', text: "Zooming into highest-risk node ACC-1004." }]);
    } else if (actionType === "GENERATE_REPORT") {
      if (toolHandlers.navigate) toolHandlers.navigate(`/report/${selectedCase}`);
      setActiveTab('chat');
    }
  };

  const handleNarrateInvestigation = () => {
    if (!selectedCase) {
      alert("Please load an active investigation first.");
      return;
    }

    const copilotContext = {
      isOpen, setIsOpen, messages, setMessages, loading, setLoading,
      streaming, setStreaming, selectedNode, selectedTransaction,
      selectedCase, setSelectedCase, currentPage, currentFilters, toolHandlers,
      currentTimeline, graphState, dashboardStats
    };

    const storySteps = ReplayEngine.compileStory(copilotContext);
    if (storySteps.length === 0) {
      alert("No data available to compile replay storyboard.");
      return;
    }

    setLoading(true);
    setStreaming(true);
    setMessages(prev => [...prev, { sender: 'user', text: "Start Autopilot Replay" }]);

    let idx = 0;
    
    // Auto-enable Executive Presentation Mode class
    const appEl = document.getElementById('root') || document.body;
    appEl.classList.add('sentinel-presentation-mode');

    const executeStep = () => {
      if (idx >= storySteps.length) {
        // Complete replay
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            structured: true,
            data: {
              title: "Investigation Scorecard",
              answer: "The autonomous investigation replay has completed. Risk Level is **Critical**.",
              confidence: 96,
              evidence: ["Root source ACC-1001", "Structuring UPIs flagged"],
              recommendations: [
                "Request KYC records for bridge conduits.",
                "Freeze round-trip loop participants immediately."
              ],
              suggested_actions: ["Print Police FIR", "Print Bank Summary"],
              follow_up_questions: ["Why is this suspicious?", "Show recommendations"]
            }
          }
        ]);
        setLoading(false);
        setStreaming(false);
        setStreamText('');
        
        // Remove presentation mode class
        appEl.classList.remove('sentinel-presentation-mode');
        return;
      }

      const step = storySteps[idx];
      setStreamText(`🎬 **Replay Step: ${step.title}** (${step.timestamp})\n\n${step.copilotNarration}`);

      // Run Graph actions
      if (step.graphActions) {
        step.graphActions.forEach(act => {
          if (act.type === "ZOOM" && toolHandlers.zoomToNode) toolHandlers.zoomToNode(act.nodeId);
          if (act.type === "HIGHLIGHT" && toolHandlers.highlightNode) toolHandlers.highlightNode(act.nodeId);
          if (act.type === "HIGHLIGHT_PATTERN" && toolHandlers.highlightPattern) {
            toolHandlers.highlightPattern(act.pattern);
          }
          if (act.type === "SELECT_TRANSACTION" && toolHandlers.selectTransaction) {
            toolHandlers.selectTransaction(act.txId);
          }
          if (act.type === "EXPAND" && toolHandlers.expandNetwork) toolHandlers.expandNetwork(act.nodeId);
          if (act.type === "RESET" && toolHandlers.resetGraph) toolHandlers.resetGraph();
          if (act.type === "CENTER" && toolHandlers.centerGraph) toolHandlers.centerGraph();
        });
      }

      // Run Timeline actions
      if (step.timelineActions) {
        step.timelineActions.forEach(act => {
          if (act.type === "FOCUS_TX") {
            const row = document.getElementById(`tx-row-${act.txId}`);
            if (row) {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
              row.classList.add('animate-pulse', 'border-red-600', 'bg-red-950/20');
              setTimeout(() => row.classList.remove('animate-pulse', 'border-red-600', 'bg-red-950/20'), 4000);
            }
          }
        });
      }

      idx++;
      setTimeout(executeStep, 5000);
    };

    executeStep();
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
      {/* 2. Persistent Floating Window */}
      {isOpen && (() => {
        // Setup context for monitor
        const monitorContext = {
          selectedCase, graphState, currentTimeline, selectedReport, toolHandlers,
          isOpen, setIsOpen, messages, setMessages, loading, setLoading,
          streaming, setStreaming, selectedNode, selectedTransaction,
          currentPage, currentFilters, dashboardStats
        };
        const monitorData = selectedCase ? InvestigationMonitor.monitor(monitorContext) : { events: [], health: null, nextActions: [] };

        return (
          <div className={`sentinel-copilot-window ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label="SENTINEL AI Copilot Interface">
            
            <CopilotHeader 
              status={connectionStatus} 
              onMinimize={handleClose} 
              onClose={handleClose} 
            />

            {/* Tab Navigation header */}
            <div className="flex border-b border-slate-800 bg-[#111827] flex-shrink-0">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 text-xs font-black tracking-wider uppercase text-center transition-all ${activeTab === 'chat' ? 'text-white border-b-2 border-red-600 bg-slate-950/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Chat Analyst
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex-1 py-2 text-xs font-black tracking-wider uppercase text-center transition-all ${activeTab === 'audit' ? 'text-white border-b-2 border-red-600 bg-slate-950/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Audit Panel
              </button>
            </div>

            {activeTab === 'audit' ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Health Score Panel */}
                {monitorData.health ? (
                  <div className="p-3 bg-[#111827] border border-[#1F2937] rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-extrabold">Investigation Health Score</span>
                      <span className="text-sm font-black text-white">{monitorData.health.overallConfidence}%</span>
                    </div>
                    
                    <div className="space-y-2 text-[10px]">
                      <div>
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span>Evidence Completeness</span>
                          <span>{monitorData.health.evidenceCompleteness}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${monitorData.health.evidenceCompleteness}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span>Pattern Confidence</span>
                          <span>{monitorData.health.patternConfidence}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600" style={{ width: `${monitorData.health.patternConfidence}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span>Graph Connectivity</span>
                          <span>{monitorData.health.graphConnectivity}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${monitorData.health.graphConnectivity}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-500 py-4 border border-dashed border-slate-800 rounded-lg">
                    Select an active investigation case to compile Case Health metrics.
                  </div>
                )}

                {/* Next Best Actions */}
                {monitorData.nextActions && monitorData.nextActions.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="sentinel-section-title">Next Best Actions</span>
                    <div className="flex flex-col gap-2">
                      {monitorData.nextActions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleNextActionClick(act.action)}
                          className="w-full p-2 bg-[#111827] hover:bg-[#1e293b] border border-[#1F2937] hover:border-red-600 text-slate-200 text-left text-xs font-semibold rounded-lg transition-all flex justify-between items-center group"
                        >
                          <span>{act.label}</span>
                          <Play size={10} className="text-slate-600 group-hover:text-red-500 fill-current" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Insights Feed */}
                {monitorData.events && monitorData.events.length > 0 && (
                  <div className="space-y-2">
                    <span className="sentinel-section-title">Live Investigation Insights</span>
                    <div className="space-y-2">
                      {monitorData.events.map((evt, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3 bg-[#111827] border-l-2 rounded-r-lg space-y-1.5 text-xs ${evt.severity === 'CRITICAL' ? 'border-red-600' : 'border-amber-500'}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-white">{evt.title}</span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${evt.severity === 'CRITICAL' ? 'bg-red-950/40 text-red-500' : 'bg-amber-950/40 text-amber-500'}`}>
                              {evt.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{evt.explanation}</p>
                          <span className="text-[9px] font-mono text-indigo-400 block">{evt.evidence}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Printable Briefs buttons */}
                {monitorData.health && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => printPoliceBrief(monitorData)}
                      className="py-2 bg-slate-900 border border-slate-800 hover:border-red-600 text-slate-200 text-xs font-black rounded-lg transition-all"
                    >
                      Print Police FIR
                    </button>
                    <button
                      onClick={() => printBankBrief(monitorData)}
                      className="py-2 bg-slate-900 border border-slate-800 hover:border-red-600 text-slate-200 text-xs font-black rounded-lg transition-all"
                    >
                      Print Bank Summary
                    </button>
                  </div>
                )}

              </div>
            ) : (
              <>
                {/* Messages Feed */}
                <div 
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="sentinel-messages-container"
                >
                  {messages.length === 0 ? (
                    selectedCase ? (() => {
                      const copilotContextForEngine = {
                        isOpen, setIsOpen, messages, setMessages, loading, setLoading,
                        streaming, setStreaming, selectedNode, selectedTransaction,
                        selectedCase, setSelectedCase, currentPage, currentFilters, toolHandlers,
                        currentTimeline, graphState, dashboardStats
                      };
                      const analysis = ReasoningEngine.analyze(copilotContextForEngine);
                      
                      return (
                        <div className="space-y-4 py-2">
                          <div className="sentinel-empty-state pb-0">
                            <div className="sentinel-empty-icon animate-bounce">
                              <Sparkles size={20} />
                            </div>
                            <h4>Autonomous Analyst Active</h4>
                            <p className="text-[10px]">
                              Scanned transaction paths for Case **{selectedCase}**.
                            </p>
                          </div>

                          {analysis && analysis.status === 'analyzed' ? (
                            <div className="space-y-3 px-1 text-slate-300">
                              
                              {/* Dynamic Insight Cards Grid */}
                              <span className="sentinel-section-title">Automatic Insight Cards</span>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div 
                                  onClick={() => {
                                    if (analysis.analytics?.moneySource?.id) {
                                      if (toolHandlers.zoomToNode) toolHandlers.zoomToNode(analysis.analytics.moneySource.id);
                                    }
                                  }}
                                  className="p-3 bg-[#111827] border border-[#1F2937] rounded-lg hover:border-[#DC2626] transition-all cursor-pointer flex flex-col gap-1"
                                >
                                  <span className="text-[8px] uppercase tracking-wider text-indigo-400 font-bold">Funding Source</span>
                                  <span className="font-mono text-white truncate">{analysis.analytics?.moneySource?.id || 'N/A'}</span>
                                  <span className="text-[9px] text-slate-400">Net Outflow Node</span>
                                </div>

                                <div 
                                  onClick={() => {
                                    if (analysis.analytics?.moneySink?.id) {
                                      if (toolHandlers.zoomToNode) toolHandlers.zoomToNode(analysis.analytics.moneySink.id);
                                    }
                                  }}
                                  className="p-3 bg-[#111827] border border-[#1F2937] rounded-lg hover:border-[#DC2626] transition-all cursor-pointer flex flex-col gap-1"
                                >
                                  <span className="text-[8px] uppercase tracking-wider text-indigo-400 font-bold">Primary Sink</span>
                                  <span className="font-mono text-white truncate">{analysis.analytics?.moneySink?.id || 'N/A'}</span>
                                  <span className="text-[9px] text-slate-400">High Inflow target</span>
                                </div>

                                <div className="p-3 bg-[#111827] border border-[#1F2937] rounded-lg flex flex-col gap-1 col-span-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[8px] uppercase tracking-wider text-indigo-400 font-bold">Circular Flows</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${analysis.indicators?.hasCircularFlow ? 'bg-red-950 text-red-400 border border-red-900/30' : 'bg-emerald-950 text-emerald-400 border border-emerald-900/30'}`}>
                                      {analysis.indicators?.hasCircularFlow ? 'WARNING' : 'CLEAR'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-300 font-semibold mt-1">
                                    {analysis.indicators?.hasCircularFlow 
                                      ? `Detected ${analysis.analytics.circularPaths.length} round-tripping cycles.` 
                                      : 'No circular loops detected.'}
                                  </span>
                                </div>
                              </div>

                              {/* Interactive Walkthrough Narration Button */}
                              <div className="pt-2">
                                <button
                                  onClick={handleNarrateInvestigation}
                                  className="w-full py-2 bg-gradient-to-r from-red-950 to-indigo-950 border border-red-800 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 hover:from-red-800 hover:to-indigo-900 transition-all shadow-md shadow-red-950/20"
                                >
                                  <Play size={12} className="fill-current" />
                                  <span>Narrate Investigation Walkthrough</span>
                                </button>
                              </div>

                            </div>
                          ) : (
                            <p className="text-center text-[10px] text-slate-500">Compiling analytical metrics...</p>
                          )}

                        </div>
                      );
                    })() : (
                      <div className="sentinel-empty-state">
                        <div className="sentinel-empty-icon">
                          <Sparkles size={24} />
                        </div>
                        <h4>Welcome to SENTINEL AI</h4>
                        <p>
                          Select an active investigation case or upload a bank statement to begin context analysis.
                        </p>
                      </div>
                    )
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
              </>
            )}

          </div>
        );
      })()}
    </div>
  );
}
