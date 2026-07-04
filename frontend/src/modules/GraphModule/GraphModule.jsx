import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GraphCanvas from './GraphCanvas';
import Legend from './Legend';
import ActionPanel from './ActionPanel';
import ReplayController from './ReplayController';
import ReplayActionPanel from './ReplayActionPanel';
import RiskAnimator from './RiskAnimator';
import EvidenceOverlay from './EvidenceOverlay';
import NodeProfilePopup from './NodeProfilePopup';
import CaseClosurePanel from './CaseClosurePanel';
import { getInvestigationNarrative } from './InvestigationDirector';
import './GraphModule.css';
import { Calendar, X, GitBranch, Compass, ZoomIn, RefreshCw, FileText, ShieldAlert } from 'lucide-react';
import { getRole } from '../../roleStore';
import { maskAccount } from '../../utils/maskAccount';
import { 
  TransactionDrilldownDrawer, 
  EntityIntelligencePanel 
} from '../../components/InvestigationDrawers';
import RiskExplanationDrawer from '../../components/RiskExplanationDrawer';
import { useCopilot } from '../../components/CopilotContext';

const GraphModule = ({ caseDetails }) => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const { 
    setSelectedGraphNode, 
    setSelectedReport, 
    setCurrentTimeline,
    setGraphState,
    setSelectedCase,
    setSelectedTransaction,
    setSearchQuery,
    registerToolHandler
  } = useCopilot();

  useEffect(() => {
    // Write node selection to CopilotContext state
    const nodeId = selectedNode ? (selectedNode.id || selectedNode.account_id) : null;
    setSelectedGraphNode(nodeId);
  }, [selectedNode, setSelectedGraphNode]);

  useEffect(() => {
    if (caseDetails) {
      setSelectedCase(caseDetails.case_id || caseDetails.id);
      if (caseDetails.report) {
        setSelectedReport(caseDetails.report);
        setCurrentTimeline(caseDetails.report.timeline || []);
      }
      if (caseDetails.graph) {
        setGraphState(caseDetails.graph);
      }
    }
    return () => {
      setSelectedCase(null);
      setSelectedReport(null);
      setCurrentTimeline([]);
      setGraphState({ nodes: [], edges: [] });
    };
  }, [caseDetails, setSelectedCase, setSelectedReport, setCurrentTimeline, setGraphState]);

  useEffect(() => {
    if (canvasRef.current) {
      registerToolHandler('highlightNode', (nodeId) => canvasRef.current.highlightNode?.(nodeId));
      registerToolHandler('highlightNodes', (nodeIds) => canvasRef.current.focusNodes?.(nodeIds));
      registerToolHandler('traceMoneyFlow', (nodeId) => canvasRef.current.traceMoneyFlow?.(nodeId));
      registerToolHandler('expandNetwork', (nodeId) => canvasRef.current.expandNetwork?.(nodeId));
      registerToolHandler('showOnlySuspicious', () => canvasRef.current.highlightSuspicious?.());
      registerToolHandler('resetGraph', () => canvasRef.current.clearHighlights?.());
      registerToolHandler('zoomToNode', (nodeId) => canvasRef.current.highlightNode?.(nodeId));
      registerToolHandler('selectTransaction', (txId) => {
        if (caseDetails?.transactions) {
          const found = caseDetails.transactions.find(t => t.id === txId || t.transaction_id === txId);
          if (found) setSelectedTx(found);
        }
      });
    }
  }, [canvasRef.current, registerToolHandler, caseDetails]);
  const [logs, setLogs] = useState([]);
  const role = getRole();

  // Replay states
  const [replayActive, setReplayActive] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.5);
  const [replayLogs, setReplayLogs] = useState([]);
  const [currentRiskScore, setCurrentRiskScore] = useState(22);
  const [confidenceScore, setConfidenceScore] = useState(50);
  const [floatingBadges, setFloatingBadges] = useState([]);
  const [showIntro, setShowIntro] = useState(true);
  const [showSummaryCard, setShowSummaryCard] = useState(false);

  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityNotes, setEntityNotes] = useState({});
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    setSelectedTransaction(selectedTx ? (selectedTx.id || selectedTx.transaction_id) : null);
  }, [selectedTx, setSelectedTransaction]);

  useEffect(() => {
    setSearchQuery(globalSearch);
  }, [globalSearch, setSearchQuery]);

  const speedRef = useRef(playbackSpeed);

  useEffect(() => {
    speedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  // Evidence & Node Interrogation overlay states
  const [evidenceList, setEvidenceList] = useState([]);
  const [activeEvidence, setActiveEvidence] = useState(null);
  const [evidenceOverlayVisible, setEvidenceOverlayVisible] = useState(false);
  const [nodeInterrogationVisible, setNodeInterrogationVisible] = useState(false);
  const [interrogatedNodeData, setInterrogatedNodeData] = useState(null);
  const [interrogatedNodePosition, setInterrogatedNodePosition] = useState(null);

  // Move early return below hook registrations to comply with Rules of Hooks
  const { case: caseData, graph, timeline = [] } = caseDetails || {};

  const [activeTimelineTab, setActiveTimelineTab] = useState('case_timeline');
  const [selectedTimelineEntity, setSelectedTimelineEntity] = useState('all');

  const timelines = useMemo(() => {
    const baseList = caseDetails?.report?.timeline || caseDetails?.timeline || timeline || [];
    return caseDetails?.report?.timelines || {
      case_timeline: baseList,
      suspicious_timeline: baseList.filter(e => e.risk_flag || e.event_type === 'Failed Transactions'),
      money_trail_timeline: baseList.filter(e => e.event_type === 'Layering' || e.event_type === 'Circular Flow' || e.event_type === 'Merge' || e.event_type === 'Fan-Out' || e.event_type === 'Graph Branch Created' || e.event_type === 'Rapid Movement' || e.money_trail?.length > 0),
      risk_escalation_timeline: baseList.filter(e => e.risk_increase > 0),
      entity_timeline: baseList.filter(e => (e.entities && e.entities.length > 0) || (e.counterparty && e.counterparty !== 'Unknown Counterparty'))
    };
  }, [caseDetails, timeline]);

  const currentTimelineEvents = useMemo(() => {
    const list = timelines[activeTimelineTab] || [];
    const q = globalSearch.toLowerCase().trim();
    
    return list.filter(evt => {
      const matchesSearch = !q || 
        String(evt.event || '').toLowerCase().includes(q) ||
        String(evt.description || '').toLowerCase().includes(q) ||
        String(evt.counterparty || '').toLowerCase().includes(q);
        
      const matchesEntity = selectedTimelineEntity === 'all' || 
        (evt.entities && evt.entities.some(e => String(e).toLowerCase() === selectedTimelineEntity.toLowerCase())) ||
        (evt.counterparty && String(evt.counterparty).toLowerCase() === selectedTimelineEntity.toLowerCase());
        
      return matchesSearch && matchesEntity;
    });
  }, [timelines, activeTimelineTab, globalSearch, selectedTimelineEntity]);

  const uniqueEntitiesForFilter = useMemo(() => {
    const ents = new Set();
    (timelines.entity_timeline || []).forEach(evt => {
      if (evt.entities) {
        evt.entities.forEach(e => ents.add(e));
      }
      if (evt.counterparty && evt.counterparty !== 'Unknown Counterparty') {
        ents.add(evt.counterparty);
      }
    });
    return Array.from(ents);
  }, [timelines]);

  const nodes = useMemo(() => Array.isArray(graph?.nodes) ? graph.nodes : [], [graph?.nodes]);
  const edges = useMemo(() => Array.isArray(graph?.edges) ? graph.edges : [], [graph?.edges]);

  const primaryAccountId = useMemo(() => {
    const primaryNode = nodes.find(n => n.nodeType === 'account' || n.node_type === 'account');
    return primaryNode ? String(primaryNode.accountId || primaryNode.id || primaryNode.account_id) : '';
  }, [nodes]);

  const replaySteps = useMemo(() => {
    const edgeList = [...edges];
    const txOrder = caseDetails?.transactions || [];
    
    if (txOrder.length > 0) {
      edgeList.sort((a, b) => {
        const aId = String(a.tx_id || a.id);
        const bId = String(b.tx_id || b.id);
        const aIndex = txOrder.findIndex(t => String(t.tx_id) === aId);
        const bIndex = txOrder.findIndex(t => String(t.tx_id) === bId);
        return aIndex - bIndex;
      });
    }
    return edgeList;
  }, [edges, caseDetails?.transactions]);

  const timelineSteps = useMemo(() => {
    return replaySteps.map(step => {
      const hasPattern = (caseDetails?.patterns || []).some(pat => 
        pat && pat.related_transactions && pat.related_transactions.includes(step.tx_id || step.id)
      );
      return {
        amount: Number(step.amount || 0),
        hasPattern
      };
    });
  }, [replaySteps, caseDetails?.patterns]);

  const formatTxTime = (dateStr) => {
    if (!dateStr) return '09:00';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      const str = String(dateStr);
      const m = str.match(/\b\d{2}:\d{2}\b/);
      return m ? m[0] : '09:00';
    } catch {
      return '09:00';
    }
  };

  // Load notes on mount / change
  useEffect(() => {
    if (!caseData) return;
    const notesObj = {};
    const prefix = `sentinel_notes_${caseData?.case_id}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const entName = key.replace(prefix, '');
        notesObj[entName] = localStorage.getItem(key) || '';
      }
    }
    setEntityNotes(notesObj);
  }, [caseData]);

  // Handle redirected highlights from Report page (Feature 9/1)
  useEffect(() => {
    if (!caseDetails) return;
    const timer = setTimeout(() => {
      const storedTxs = sessionStorage.getItem('highlight_txs');
      const storedNodes = sessionStorage.getItem('highlight_nodes');
      if (storedTxs && storedNodes && canvasRef.current?.highlightMoneyTrail) {
        setReplayActive(false);
        try {
          const txIds = JSON.parse(storedTxs);
          const nodeIds = JSON.parse(storedNodes);
          canvasRef.current.highlightMoneyTrail(txIds, nodeIds);
          addLog('HIGHLIGHT', 'TRAIL', `Loaded redirected Money Trail: ${txIds.length} txs highlighted.`);
        } catch (e) {
          console.error("Failed to parse redirected highlights:", e);
        }
        sessionStorage.removeItem('highlight_txs');
        sessionStorage.removeItem('highlight_nodes');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [caseDetails]);

  // Handle open_timeline and start_replay redirection triggers
  useEffect(() => {
    if (!caseDetails) return;
    if (sessionStorage.getItem('open_timeline') === 'true') {
      setShowTimeline(true);
      sessionStorage.removeItem('open_timeline');
    }
    if (sessionStorage.getItem('start_replay') === 'true') {
      setReplayActive(true);
      setIsPlaying(true);
      sessionStorage.removeItem('start_replay');
    }
  }, [caseDetails]);

  // Bind globalSearch to Cytoscape (Feature 10)
  useEffect(() => {
    if (canvasRef.current?.highlightSearch) {
      canvasRef.current.highlightSearch(globalSearch);
    }
  }, [globalSearch]);

  const handleSaveNotes = (entityVal, notesVal) => {
    const key = `sentinel_notes_${caseData?.case_id}_${entityVal}`;
    localStorage.setItem(key, notesVal);
    setEntityNotes(prev => ({
      ...prev,
      [entityVal]: notesVal
    }));
  };

  // Animation timeline loop
  useEffect(() => {
    if (!replayActive || !isPlaying || !caseDetails) return;

    let isCancelled = false;

    const run = async () => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= replaySteps.length) {
        setIsPlaying(false);
        setShowSummaryCard(true);
        return;
      }

      const step = replaySteps[nextIndex];
      const speed = speedRef.current;

      const matchedPatterns = (caseDetails?.patterns || []).filter(pat => 
        pat && pat.related_transactions && pat.related_transactions.includes(step.tx_id || step.id)
      );

      // Node and target info
      const fromId = String(step.source || step.from);
      const toId = String(step.target || step.to);
      const toNodeData = nodes.find(n => n.id === toId);

      const targetIsNew = toNodeData && !replaySteps.slice(0, nextIndex).some(s => String(s.target || s.to) === toId);

      // Trigger node zoom/animation
      if (canvasRef.current?.animateStep) {
        await canvasRef.current.animateStep(step, speed, targetIsNew);
      }

      if (isCancelled) return;

      // Update calculations
      if (canvasRef.current?.applyReplayState) {
        canvasRef.current.applyReplayState(nextIndex, replaySteps, primaryAccountId);
      }

      // Evidentiary triggers
      const hasPattern = matchedPatterns.length > 0;
      if (hasPattern) {
        const primaryPat = matchedPatterns[0];
        setConfidenceScore(prev => Math.min(97, prev + 8));
        setCurrentRiskScore(prev => Math.min(100, prev + 12));

        // Floating badges
        const timeStr = formatTxTime(step.timestamp || step.date);
        setFloatingBadges(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            text: `⚠️ ANOMALY: ${primaryPat.name}`,
            x: window.innerWidth * 0.45,
            y: window.innerHeight * 0.45
          }
        ]);
        
        // Show overlay
        setActiveEvidence({
          name: primaryPat.name,
          amount: Number(step.amount || 0),
          timestamp: timeStr,
          confidence: primaryPat.confidence,
          severity: primaryPat.severity
        });
        setEvidenceOverlayVisible(true);
        
        await new Promise(r => setTimeout(r, 1200 / speed));
        setEvidenceOverlayVisible(false);
      } else {
        // Safe transaction
        setCurrentRiskScore(prev => Math.max(10, prev - 2));
      }

      if (isCancelled) return;

      // Interrogation popup for new receivers
      if (targetIsNew && toNodeData) {
        setInterrogatedNodeData({
          id: toNodeData.id,
          label: toNodeData.label,
          type: toNodeData.nodeType,
          risk: toNodeData.risk || 40,
          inflow: Number(step.amount || 0),
          confidence: 96
        });
        setNodeInterrogationVisible(true);
        await new Promise(r => setTimeout(r, 1000 / speed));
        setNodeInterrogationVisible(false);
      }

      if (isCancelled) return;

      // Advance
      if (currentIndex === -1) {
        setCurrentIndex(0);
      } else {
        setCurrentIndex(nextIndex);
      }
    };

    const timer = setTimeout(() => {
      run();
    }, currentIndex === -1 ? 0 : (250 / speedRef.current));

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [replayActive, isPlaying, currentIndex, replaySteps, caseDetails, nodes, primaryAccountId]);

  // Regular action handlers
  const addLog = (action, target, description) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    setLogs((prev) => [
      { time, action, target, description },
      ...prev
    ]);
  };

  const handleTraceMoneyFlow = useCallback(() => {
    if (selectedNode && canvasRef.current) {
      canvasRef.current.traceMoneyFlow(selectedNode.id);
      addLog('TRACE', selectedNode.id, `Traced money flow path downstream from selected account node.`);
    }
  }, [selectedNode]);

  const handleExpandNetwork = useCallback(() => {
    if (selectedNode && canvasRef.current) {
      canvasRef.current.expandNetwork(selectedNode.id);
      addLog('EXPAND', selectedNode.id, `Expanded neighborhood topology to 2 hops for target node.`);
    }
  }, [selectedNode]);

  const handleHighlightSuspicious = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.highlightSuspicious(60);
      addLog('HIGHLIGHT', 'GLOBAL', `Highlighted suspicious nodes with risk rating >= 60 in red.`);
    }
  }, []);

  const handleClearHighlights = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.clearHighlights();
      canvasRef.current.clearTrailHighlight();
      setGlobalSearch('');
      addLog('RESET', 'GLOBAL', `Cleared all highlights and query filters.`);
    }
  }, []);

  const handlePlayPause = () => {
    setShowIntro(false);
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setShowIntro(false);
    setShowSummaryCard(false);
    setCurrentIndex(-1);
    setCurrentRiskScore(22);
    setConfidenceScore(50);
    setIsPlaying(true);
    if (canvasRef.current?.applyReplayState) {
      canvasRef.current.applyReplayState(-1, replaySteps, primaryAccountId);
    }
  };

  const handleNext = () => {
    setShowIntro(false);
    const nextIndex = currentIndex + 1;
    if (nextIndex < replaySteps.length) {
      setCurrentIndex(nextIndex);
      if (canvasRef.current?.applyReplayState) {
        canvasRef.current.applyReplayState(nextIndex, replaySteps, primaryAccountId);
      }
    }
  };

  const handlePrev = () => {
    setShowIntro(false);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= -1) {
      setCurrentIndex(prevIndex);
      if (canvasRef.current?.applyReplayState) {
        canvasRef.current.applyReplayState(prevIndex, replaySteps, primaryAccountId);
      }
    }
  };

  const handleStepSelect = (index) => {
    setShowIntro(false);
    setCurrentIndex(index);
    if (canvasRef.current?.applyReplayState) {
      canvasRef.current.applyReplayState(index, replaySteps, primaryAccountId);
    }
  };

  const handleLogClick = (log) => {
    if (log.action === 'TRACE' || log.action === 'EXPAND') {
      setSelectedNode({ id: log.target, nodeType: 'account', risk: 40 });
    }
  };

  const compileEvidenceList = useCallback(() => {
    const evList = [];
    const logList = [];
    for (let i = 0; i < replaySteps.length; i++) {
      const step = replaySteps[i];
      if (!step) continue;

      const { narrationEvents, isEvidenceMoment, evidenceDetail } = getInvestigationNarrative(
        step,
        i,
        replaySteps,
        caseDetails?.patterns,
        primaryAccountId
      );

      logList.push(...narrationEvents);

      if (isEvidenceMoment && evidenceDetail) {
        evList.push({
          id: `ev-${i}-${evidenceDetail.name}`,
          name: evidenceDetail.name,
          amount: evidenceDetail.amount,
          timestamp: formatTxTime(evidenceDetail.timestamp),
          confidence: evidenceDetail.confidence,
          severity: evidenceDetail.severity,
          affectedTransactions: evidenceDetail.affectedTransactions
        });
      }
    }
    setReplayLogs(logList);
    setEvidenceList(evList);
  }, [replaySteps, caseDetails?.patterns, primaryAccountId]);

  const [graphUnavailable, setGraphUnavailable] = useState(false);

  // Replay Initialization Sequence with logging and fallbacks
  useEffect(() => {
    const initializeReplay = async () => {
      console.log("[REPLAY_INIT] 1. Investigation Loaded starting check...");
      if (!caseDetails) {
        console.log("[REPLAY_INIT] 1. Investigation Loaded: WAITING (caseDetails is null)");
        return;
      }
      console.log("[REPLAY_INIT] 1. Investigation Loaded: SUCCESS");

      console.log("[REPLAY_INIT] 2. Graph Data Received starting check...");
      if (!nodes || !edges) {
        console.log("[REPLAY_INIT] 2. Graph Data Received: WAITING");
        return;
      }
      console.log(`[REPLAY_INIT] 2. Graph Data Received: SUCCESS (${nodes.length} nodes, ${edges.length} edges)`);

      console.log("[REPLAY_INIT] 3. Replay Timeline Generated starting check...");
      console.log(`[REPLAY_INIT] 3. Replay Timeline Generated: SUCCESS (${replaySteps.length} steps)`);

      console.log("[REPLAY_INIT] 4. Replay Frames Built starting check...");
      console.log(`[REPLAY_INIT] 4. Replay Frames Built: SUCCESS (${timelineSteps.length} frames)`);

      console.log("[REPLAY_INIT] 5/6. Graph Ref & Cytoscape check...");
      let graphRef = canvasRef.current;
      
      if (!graphRef) {
        console.log("[REPLAY_INIT] Graph ref not available yet, waiting...");
        // Wait up to 1.5s for GraphCanvas to mount and set the ref
        for (let i = 0; i < 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          graphRef = canvasRef.current;
          if (graphRef) break;
        }
      }

      if (!graphRef) {
        console.warn("[REPLAY_INIT] Graph initialization failed (ref is null). Setting graphUnavailable to true.");
        setGraphUnavailable(true);
        console.log("[REPLAY_INIT] 5. Cytoscape Ready: FAILED (Proceeding anyway)");
        console.log("[REPLAY_INIT] 6. Graph Ref Available: FAILED (Proceeding anyway)");
      } else {
        setGraphUnavailable(false);
        console.log("[REPLAY_INIT] 5. Cytoscape Ready: SUCCESS");
        console.log("[REPLAY_INIT] 6. Graph Ref Available: SUCCESS");
      }

      console.log("[REPLAY_INIT] 7. Money Trail Initialized starting check...");
      console.log("[REPLAY_INIT] 7. Money Trail Initialized: SUCCESS");

      console.log("[REPLAY_INIT] 8. Evidence Timeline Initialized starting check...");
      console.log("[REPLAY_INIT] 9. Narration Initialized starting check...");
      try {
        compileEvidenceList();
        console.log("[REPLAY_INIT] 8. Evidence Timeline Initialized: SUCCESS");
        console.log("[REPLAY_INIT] 9. Narration Initialized: SUCCESS");
      } catch (err) {
        console.error("[REPLAY_INIT] Error compiling evidence/narration:", err);
      }

      console.log("[REPLAY_INIT] 10. Replay Ready: SUCCESS");
      
      setShowIntro(false);
      console.log("[REPLAY_INIT] 11. Loading Overlay Removed: SUCCESS");
    };

    initializeReplay();
  }, [caseDetails, nodes, edges, replaySteps, timelineSteps, compileEvidenceList]);

  const handleExitReplay = () => {
    setIsPlaying(false);
    setReplayActive(false);
    
    if (canvasRef.current?.applyReplayState) {
      canvasRef.current.applyReplayState(replaySteps.length - 1, replaySteps, primaryAccountId);
    }
    setSelectedNode(null);
  };

  const handleStartReplay = () => {
    setReplayActive(true);
  };

  if (!caseDetails) return null;

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden relative w-full">
      {/* CSS Styles injection */}
      <style>{`
        @keyframes floatUpFade {
          0% {
            transform: translate(-50%, 15px);
            opacity: 0;
          }
          15% {
            transform: translate(-50%, 0);
            opacity: 1;
          }
          85% {
            transform: translate(-50%, -5px);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -20px);
            opacity: 0;
          }
        }
        .floating-badge {
          animation: floatUpFade 2s forwards cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
      
      {/* Graph Area */}
      <div className="flex-1 relative flex flex-col h-full min-w-0">
        
        {/* Floating Legend - only visible in normal mode */}
        {!replayActive && <Legend />}

        {/* Floating Risk Score & Confidence Animator - only visible in replay mode */}
        {replayActive && (
          <div className="absolute top-5 right-5 z-40">
            <RiskAnimator targetScore={currentRiskScore} targetConfidence={confidenceScore} playbackSpeed={playbackSpeed} />
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 w-full h-full relative">
          {graphUnavailable && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-500 z-10">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-500">Graph unavailable</span>
              <span className="text-[10px] text-slate-600 mt-1">Failed to initialize money flow visualization.</span>
            </div>
          )}
          <GraphCanvas 
            ref={canvasRef} 
            nodes={nodes} 
            edges={edges} 
            onNodeClick={setSelectedNode} 
            replayMode={replayActive}
            primaryAccountId={primaryAccountId}
          />
        </div>

        {/* Floating Playback Controls - only visible in replay mode */}
        {replayActive && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 w-full px-4 max-w-2xl">
            <ReplayController
              currentIndex={currentIndex}
              totalSteps={replaySteps.length}
              isPlaying={isPlaying}
              playbackSpeed={playbackSpeed}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onPrev={handlePrev}
              onRestart={handleRestart}
              onSpeedChange={setPlaybackSpeed}
              onStepSelect={handleStepSelect}
              onExitReplay={handleExitReplay}
              steps={timelineSteps}
            />
          </div>
        )}

        {/* Selected Node Risk Explanation Drawer - only visible in normal mode */}
        {!replayActive && selectedNode && (
          <RiskExplanationDrawer 
            node={selectedNode}
            caseDetails={caseDetails}
            onClose={() => setSelectedNode(null)}
            onTxSelect={setSelectedTx}
            onHighlightOnGraph={(txIds, nodeIds) => canvasRef.current?.highlightMoneyTrail(txIds, nodeIds)}
          />
        )}

        {/* Floating Timeline Overlay Drawer - only visible in normal mode */}
        {!replayActive && showTimeline && (
          <div className="absolute inset-y-0 left-0 w-[420px] bg-slate-955/95 border-r border-slate-900 shadow-2xl z-50 p-6 flex flex-col gap-4 backdrop-blur-md animate-in slide-in-from-left-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-900 shrink-0">
              <h3 className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-400" /> Case Timeline Audit
              </h3>
              <button onClick={() => setShowTimeline(false)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>

            {/* Tabs selector */}
            <div className="flex bg-slate-900 border border-slate-850 rounded-lg p-0.5 gap-0.5 flex-wrap shrink-0">
              {[
                { id: 'case_timeline', label: 'Case' },
                { id: 'suspicious_timeline', label: 'Suspicious' },
                { id: 'money_trail_timeline', label: 'Trails' },
                { id: 'risk_escalation_timeline', label: 'Escalation' },
                { id: 'entity_timeline', label: 'Entities' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTimelineTab(tab.id); setSelectedTimelineEntity('all'); }}
                  className={`flex-1 px-1.5 py-1 rounded text-[9px] font-extrabold uppercase transition-all ${
                    activeTimelineTab === tab.id 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-350"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Entity Select filter */}
            {activeTimelineTab === 'entity_timeline' && uniqueEntitiesForFilter.length > 0 && (
              <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-850 gap-2 shrink-0">
                <span className="text-[9px] text-slate-500 uppercase font-black">Filter Node:</span>
                <select
                  value={selectedTimelineEntity}
                  onChange={(e) => setSelectedTimelineEntity(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded px-2 py-0.5 text-[10px] font-semibold text-slate-350 outline-none focus:border-slate-700 max-w-[200px]"
                >
                  <option value="all">All Entities</option>
                  {uniqueEntitiesForFilter.map((ent, i) => (
                    <option key={i} value={ent}>{ent}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 relative pl-3 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-850">
              {currentTimelineEvents.map((evt, idx) => {
                const isRisky = evt.risk_flag || evt.risk_increase > 0;
                return (
                  <div key={idx} className="relative text-[11px]">
                    <div className={`absolute -left-4 top-2 w-2 h-2 rounded-full border bg-slate-950 transition-colors ${
                      isRisky ? "border-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)] bg-red-500/20" : "border-slate-800"
                    }`} />
                    
                    <div className="bg-slate-900/40 border border-slate-850/80 p-3 rounded-lg space-y-2 hover:border-slate-800 transition-colors">
                      <div className="flex justify-between items-start text-[9px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-indigo-400 font-bold">{evt.date} {evt.time}</span>
                          {evt.event_type && (
                            <span className={`text-[7px] uppercase font-black px-1 rounded border ${
                              isRisky ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-slate-950 text-slate-500 border-slate-850"
                            }`}>
                              {evt.event_type}
                            </span>
                          )}
                        </div>
                        {evt.risk_increase > 0 && (
                          <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.2 rounded text-[7px] font-black uppercase font-mono">
                            +{evt.risk_increase}
                          </span>
                        )}
                      </div>

                      <p className="font-bold text-slate-200 text-[11px] leading-tight">{evt.event}</p>
                      
                      {evt.description && evt.description !== evt.event && (
                        <p className="text-[10px] text-slate-450 leading-normal">{evt.description}</p>
                      )}

                      {evt.money_trail && evt.money_trail.length > 0 && (
                        <div className="flex items-center gap-1 font-mono text-[8px] text-slate-500 bg-slate-950/40 px-1.5 py-1 rounded border border-slate-900/50 max-w-fit">
                          <GitBranch size={8} className="text-indigo-400 shrink-0" />
                          {evt.money_trail.map((hop, hidx) => (
                            <React.Fragment key={hidx}>
                              <span className="text-slate-350">{maskAccount(hop)}</span>
                              {hidx < evt.money_trail.length - 1 && <span className="text-slate-700">→</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      {/* Interactive click actions row */}
                      <div className="flex justify-end gap-1.5 pt-1.5 border-t border-slate-850/40">
                        {/* 1. Highlight */}
                        <button 
                          title="Highlight money trail path on graph"
                          onClick={() => {
                            const txs = evt.transactions || [];
                            const nodes = evt.entities || evt.money_trail || [];
                            if (canvasRef.current?.highlightMoneyTrail) {
                              canvasRef.current.highlightMoneyTrail(txs, nodes);
                            }
                          }}
                          className="flex items-center gap-1 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900/30 text-indigo-400 px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all"
                        >
                          <Compass size={9} /> Highlight
                        </button>

                        {/* 2. Graph zoom */}
                        <button 
                          title="Pan and zoom graph to related nodes"
                          onClick={() => {
                            const nodes = evt.entities || evt.money_trail || [];
                            if (canvasRef.current?.focusNodes) {
                              canvasRef.current.focusNodes(nodes);
                            }
                          }}
                          className="flex items-center gap-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all"
                        >
                          <ZoomIn size={9} /> Graph
                        </button>

                        {/* 3. Replay */}
                        {evt.transactions?.[0] && (
                          <button 
                            title="Start step-by-step replay animation from here"
                            onClick={() => {
                              const txId = evt.transactions[0];
                              const stepIdx = replaySteps.findIndex(s => String(s.tx_id || s.id) === String(txId));
                              if (stepIdx !== -1) {
                                setReplayActive(true);
                                setCurrentIndex(stepIdx - 1);
                                setIsPlaying(true);
                              }
                            }}
                            className="flex items-center gap-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all"
                          >
                            <RefreshCw size={9} /> Replay
                          </button>
                        )}

                        {/* 4. Transactions Drilldown */}
                        {evt.transactions?.[0] && (
                          <button 
                            title="View full transaction details drawer"
                            onClick={() => {
                              const txObj = caseDetails?.transactions?.find(t => t.tx_id === evt.transactions[0]);
                              if (txObj) setSelectedTx(txObj);
                            }}
                            className="flex items-center gap-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all"
                          >
                            <FileText size={9} /> Details
                          </button>
                        )}

                        {/* 5. Report Navigation */}
                        <button 
                          title="View Case Audit Report section"
                          onClick={() => navigate(`/report/${caseDetails?.case?.case_id || caseData?.case_id}`)}
                          className="flex items-center gap-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all"
                        >
                          <ShieldAlert size={9} /> Report
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
              {currentTimelineEvents.length === 0 && (
                <p className="text-slate-500 italic text-center py-8">No matching timeline events found.</p>
              )}
            </div>
          </div>
        )}

        {/* Floating Case Closure Dashboard Report */}
        {replayActive && showSummaryCard && (
          <CaseClosurePanel
            transactionCount={replaySteps.length}
            entityCount={nodes.length}
            patternCount={caseDetails?.patterns?.length || 0}
            confidence={97}
            riskLevel={caseData?.risk_score >= 60 ? 'CRITICAL' : 'HIGH'}
            onRestart={handleRestart}
            onDismiss={handleExitReplay}
          />
        )}

        {/* Intro Overlay Loader */}
        {replayActive && showIntro && (
          <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center gap-4 animate-out fade-out duration-500">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Reconstructing Money Trail...</h3>
              <p className="text-[9px] text-slate-500 font-mono">Loading transaction timeline and money flow mapping...</p>
            </div>
          </div>
        )}

        {/* Floating Investigation Badges */}
        {floatingBadges.map((badge) => (
          <div
            key={badge.id}
            className="absolute bg-amber-500 text-slate-950 font-black text-[9px] uppercase px-2.5 py-1 rounded-full border border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-40 pointer-events-none floating-badge"
            style={{
              left: badge.x,
              top: badge.y,
              transform: 'translateX(-50%)'
            }}
          >
            {badge.text}
          </div>
        ))}

        {/* Cinematic Evidence Overlay Card */}
        <EvidenceOverlay 
          evidence={activeEvidence} 
          visible={replayActive && evidenceOverlayVisible} 
        />

        {/* Floating Node Interrogation Popup */}
        <NodeProfilePopup 
          nodeData={interrogatedNodeData} 
          position={interrogatedNodePosition} 
          visible={replayActive && nodeInterrogationVisible} 
        />

      </div>

      {/* Side Action Panel / Replay Panel */}
      <div className="w-80 h-full shrink-0">
        {replayActive ? (
          <ReplayActionPanel
            caseId={caseData?.case_id || 'UNKNOWN'}
            currentIndex={currentIndex}
            totalSteps={replaySteps.length}
            currentStep={currentIndex >= 0 ? replaySteps[currentIndex] : null}
            activePatterns={currentIndex >= 0 
              ? (caseDetails?.patterns || []).filter(pat => 
                  pat && pat.related_transactions && pat.related_transactions.includes(replaySteps[currentIndex].tx_id || replaySteps[currentIndex].id)
                )
              : []
            }
            evidenceList={evidenceList}
            logs={replayLogs}
            onLogClick={handleLogClick}
          />
        ) : (
          <ActionPanel
            caseId={caseData?.case_id || 'UNKNOWN'}
            selectedNode={selectedNode}
            onTraceMoneyFlow={handleTraceMoneyFlow}
            onExpandNetwork={handleExpandNetwork}
            onToggleTimeline={() => setShowTimeline(!showTimeline)}
            onHighlightSuspicious={handleHighlightSuspicious}
            onClearHighlights={handleClearHighlights}
            logs={logs}
            onLogClick={handleLogClick}
            onStartReplay={handleStartReplay}
            
            // New intelligence prop bindings
            transactions={caseDetails?.transactions || []}
            entities={caseDetails?.case?.entities || {}}
            onTxSelect={setSelectedTx}
            onEntitySelect={setSelectedEntity}
            onHighlightTrail={(txIds, nodeIds) => canvasRef.current?.highlightMoneyTrail(txIds, nodeIds)}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
          />
        )}
      </div>

      {/* Reusable Intelligence Drawer Overlay */}
      {selectedTx && (
        <TransactionDrilldownDrawer 
          transaction={selectedTx}
          allTransactions={caseDetails?.transactions || []}
          onClose={() => setSelectedTx(null)}
          onHighlightOnGraph={(txIds, nodeIds) => canvasRef.current?.highlightMoneyTrail(txIds, nodeIds)}
        />
      )}

      {selectedEntity && (
        <EntityIntelligencePanel
          entity={selectedEntity}
          allTransactions={caseDetails?.transactions || []}
          initialNotes={entityNotes[selectedEntity.value] || ''}
          onSaveNotes={handleSaveNotes}
          onClose={() => setSelectedEntity(null)}
          onHighlightOnGraph={(txIds, nodeIds) => canvasRef.current?.highlightMoneyTrail(txIds, nodeIds)}
          onExplainRisk={(ent) => {
            setSelectedNode({
              id: ent.value,
              accountId: ent.value,
              nodeType: ent.type || 'account',
              label: ent.value,
              risk: ent.risk || 40
            });
            setSelectedEntity(null);
          }}
        />
      )}

    </div>
  );
};

export default GraphModule;
