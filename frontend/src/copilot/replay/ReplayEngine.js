// SENTINEL Forensic Investigation Replay Engine
// Generates a chronological storyboard of actions, views, and narration scripts for hackathon demo walk-throughs.

import { ReasoningEngine } from '../reasoning/ReasoningEngine';

export const ReplayEngine = {
  
  // Compiles chronological storyboard steps from active case data
  compileStory: (context) => {
    const analysis = ReasoningEngine.analyze(context);
    if (!analysis || analysis.status === 'empty') {
      return [];
    }

    const steps = [];
    const caseId = context.selectedCase;
    const nodes = context.graphState?.nodes || [];
    const edges = context.graphState?.edges || [];
    
    // Sort edges/transactions chronologically by time if available
    const sortedTxs = [...edges].map(e => e.data || e).sort((a, b) => {
      const timeA = a.time || a.timestamp || '';
      const timeB = b.time || b.timestamp || '';
      return timeA.localeCompare(timeB);
    });

    // Step 1: Initializing Case Topology
    steps.push({
      timestamp: "00:00",
      title: "Case Reconstruction",
      description: `Reconstructing transaction topology for Case **${caseId}**.`,
      graphActions: [{ type: "CENTER" }],
      timelineActions: [{ type: "SCROLL", index: 0 }],
      sidebarActions: [],
      copilotNarration: `Investigation loaded. Reconstructing the financial transaction topology for Case Reference ${caseId}. We are scanning ${nodes.length} connected entities.`
    });

    // Step 2: Highlight Root Funding Source
    const sourceId = analysis.analytics.moneySource.id;
    if (sourceId) {
      steps.push({
        timestamp: "00:05",
        title: "Funding Origin Focused",
        description: `Primary net outflow originating from account **${sourceId}**.`,
        graphActions: [{ type: "ZOOM", nodeId: sourceId }, { type: "HIGHLIGHT", nodeId: sourceId }],
        timelineActions: [],
        sidebarActions: [{ type: "OPEN_DOSSIER", entityId: sourceId }],
        copilotNarration: `Our advanced graph analysis identifies account ${sourceId} as the primary funding origin, which exhibits a significant net outflow.`
      });
    }

    // Step 3: Layering/Bridge Account Forwarding
    const bridgeId = analysis.analytics.bridgeAccounts[0];
    if (bridgeId) {
      steps.push({
        timestamp: "00:10",
        title: "Layering Conduit Identified",
        description: `Intermediate node **${bridgeId}** routed funds downstream within close time ranges.`,
        graphActions: [
          { type: "HIGHLIGHT", nodeId: bridgeId },
          { type: "EXPAND", nodeId: bridgeId }
        ],
        timelineActions: [],
        sidebarActions: [],
        copilotNarration: `We have detected a layering conduit node, account ${bridgeId}. Funds routed through this account are rapidly split and forwarded downstream to mask their origins.`
      });
    }

    // Step 4: Circular Loop Confirmation
    if (analysis.indicators.hasCircularFlow) {
      steps.push({
        timestamp: "00:15",
        title: "Circular Money Flow Loop Detected",
        description: `Round-tripping loop identified returning funds to originating accounts.`,
        graphActions: [{ type: "HIGHLIGHT_PATTERN", pattern: "Circular" }],
        timelineActions: [],
        sidebarActions: [],
        copilotNarration: `Anomalous circular money flows are confirmed. The transaction trail shows funds cycling through multiple shell participants back to the original source.`
      });
    }

    // Step 5: Structuring Patterns Found
    if (analysis.indicators.hasStructuring) {
      // Find the first structuring transaction (value ~ 45,000-50,000)
      const structTx = sortedTxs.find(tx => {
        const amt = Number(tx.amount || 0);
        return amt >= 45000 && amt < 50000;
      });
      const txId = structTx ? (structTx.id || structTx.transaction_id) : 'TX-102';

      steps.push({
        timestamp: "00:20",
        title: "Structuring Patterns Tagged",
        description: `Multiple sub-50,000 transactions detected near limits. Focus: **${txId}**.`,
        graphActions: [{ type: "SELECT_TRANSACTION", txId: txId }],
        timelineActions: [{ type: "FOCUS_TX", txId: txId }],
        sidebarActions: [{ type: "OPEN_TRANSACTION", txId: txId }],
        copilotNarration: `We've flagged repeated transfers split just below the reporting thresholds. Focus is centered on structured transaction reference ${txId}.`
      });
    }

    // Step 6: Final Scorecard Compile
    steps.push({
      timestamp: "00:25",
      title: "Case Analysis Finalized",
      description: "Forensic summary report and audit logs compiled.",
      graphActions: [{ type: "RESET" }],
      timelineActions: [],
      sidebarActions: [],
      copilotNarration: `Walkthrough complete. Risk score: Critical. Case health details, Police FIR briefs, and banking summaries are now ready in the Audit Panel.`
    });

    return steps;
  }
};
