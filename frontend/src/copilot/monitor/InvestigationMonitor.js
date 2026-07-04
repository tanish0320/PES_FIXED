// SENTINEL Live Investigation Monitor & Next Best Action Engine
import { ReasoningEngine } from '../reasoning/ReasoningEngine';

export const InvestigationMonitor = {
  
  // Monitor active context and generate prioritized live event insights
  monitor: (context) => {
    const analysis = ReasoningEngine.analyze(context);
    if (!analysis || analysis.status === 'empty') {
      return {
        events: [],
        health: null,
        nextActions: []
      };
    }

    const events = [];
    const nextActions = [];

    // 1. Check for Circular Flow Loop
    if (analysis.indicators.hasCircularFlow) {
      events.push({
        id: "evt_circ_flow",
        type: "ROUND_TRIP_COMPLETED",
        severity: "CRITICAL",
        title: "Circular Money Flow Loop Detected",
        explanation: "Funds are cycling back to the root account. This represents high-probability round-tripping layering schemes.",
        evidence: analysis.analytics.circularPaths[0] ? `Loop: ${analysis.analytics.circularPaths[0].join(' -> ')}` : "Feedback loop detected",
        recommendation: "Flag circular path accounts for immediate debit freezes.",
        actionType: "HIGHLIGHT_CIRCULAR",
        timestamp: new Date().toLocaleTimeString()
      });
      nextActions.push({
        label: "Inspect Circular Transfer Loop",
        action: "HIGHLIGHT_CIRCULAR"
      });
    }

    // 2. Check for Layering Conduit
    if (analysis.indicators.hasLayering) {
      events.push({
        id: "evt_layering",
        type: "NEW_LAYERING_CHAIN",
        severity: "HIGH",
        title: "Active Layering Chain Detected",
        explanation: "Funds are being routed rapidly through bridge accounts to mask transfer origins.",
        evidence: analysis.analytics.bridgeAccounts[0] ? `Bridge Account: ${analysis.analytics.bridgeAccounts[0]}` : "Intermediate node split",
        recommendation: "Request full ledger accounts from conduit banks.",
        actionType: "HIGHLIGHT_LAYERING",
        timestamp: new Date().toLocaleTimeString()
      });
      nextActions.push({
        label: "Expand Beneficiary Network",
        action: "EXPAND_NETWORK"
      });
    }

    // 3. Check for Structuring
    if (analysis.indicators.hasStructuring) {
      events.push({
        id: "evt_structuring",
        type: "NEW_STRUCTURING_PATTERN",
        severity: "HIGH",
        title: "Anomalous Structuring Pattern Found",
        explanation: "Multiple UPI transactions are split just below the ₹50,000 reporting threshold limits.",
        evidence: "Multiple sub-50,000 transactions detected.",
        recommendation: "Submit Suspicious Transaction Reports (STR) to financial intelligence unit.",
        actionType: "FILTER_UPI",
        timestamp: new Date().toLocaleTimeString()
      });
      nextActions.push({
        label: "Review structuring UPI attempts",
        action: "FILTER_UPI"
      });
    }

    // 4. Check for Dormant Account
    if (analysis.indicators.hasDormantActivation) {
      events.push({
        id: "evt_dormant",
        type: "DORMANT_ACCOUNT_ACTIVATED",
        severity: "MEDIUM",
        title: "Suspicious Dormant Account Activation",
        explanation: "An account with historically low activity suddenly received high-volume credits.",
        evidence: `Source Node: ${analysis.analytics.moneySource?.id || 'Flagged Node'}`,
        recommendation: "Initiate enhanced due diligence verification on target account registration.",
        actionType: "HIGHLIGHT_SOURCE",
        timestamp: new Date().toLocaleTimeString()
      });
      nextActions.push({
        label: "Investigate Root Funding Source",
        action: "HIGHLIGHT_SOURCE"
      });
    }

    // 5. Default high-value transaction warnings
    const maxTx = analysis.metrics.maxRisk >= 60;
    if (maxTx) {
      nextActions.push({
        label: "Zoom to Highest Risk Account",
        action: "ZOOM_HIGHEST"
      });
    }

    nextActions.push({
      label: "Generate Executive Report",
      action: "GENERATE_REPORT"
    });

    // 6. Case Health Score panel calculation
    const health = computeCaseHealth(analysis);

    return {
      events: events.sort((a, b) => getSeverityWeight(b.severity) - getSeverityWeight(a.severity)),
      health,
      nextActions
    };
  }
};

// Helper: Weight for priority sorting
function getSeverityWeight(severity) {
  switch (severity) {
    case "CRITICAL": return 4;
    case "HIGH": return 3;
    case "MEDIUM": return 2;
    case "LOW": return 1;
    default: return 0;
  }
}

// Helper: Compute case health metrics
function computeCaseHealth(analysis) {
  // Quantify evidence based on counts
  const evidenceComp = Math.min(100, Math.max(30, analysis.metrics.totalTransactions * 12));
  const patternConf = analysis.indicators.hasCircularFlow ? 95 : 75;
  const entityCoverage = analysis.entities.persons.length > 0 ? 90 : 60;
  const graphConnectivity = Math.min(100, Math.max(40, (analysis.metrics.totalTransactions / Math.max(1, analysis.metrics.totalAccounts)) * 50));
  
  const overall = Math.round((evidenceComp + patternConf + entityCoverage + graphConnectivity) / 4);

  return {
    evidenceCompleteness: evidenceComp,
    patternConfidence: patternConf,
    entityCoverage: entityCoverage,
    graphConnectivity: Math.round(graphConnectivity),
    overallConfidence: overall
  };
}
