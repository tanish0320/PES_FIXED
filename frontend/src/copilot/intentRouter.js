import { copilotTools } from './tools';

export const routeAndExecute = (query, context) => {
  const q = query.toLowerCase().trim();

  // 1. Navigation tools
  if (q.includes("go to dashboard") || q.includes("open dashboard")) {
    const res = copilotTools.goToDashboard(context);
    return makeResponse(res, ["Upload panel", "Investigations"]);
  }
  if (q.includes("go to graph") || q.includes("open graph")) {
    const res = copilotTools.goToGraph(context);
    return makeResponse(res, ["Explain this investigation", "Trace money flow"]);
  }
  if (q.includes("go to report") || q.includes("open report")) {
    const res = copilotTools.goToReport(context);
    return makeResponse(res, ["Summarize report", "Explain risk score"]);
  }
  if (q.includes("go to timeline") || q.includes("open timeline")) {
    const res = copilotTools.goToTimeline(context);
    return makeResponse(res, ["Summarize timeline"]);
  }
  if (q.includes("go to transactions") || q.includes("open transactions")) {
    const res = copilotTools.goToTransactions(context);
    return makeResponse(res, ["Filter UPI", "Clear filters"]);
  }
  if (q.includes("go to cases") || q.includes("go to investigations") || q.includes("open investigations")) {
    const res = copilotTools.goToInvestigations(context);
    return makeResponse(res);
  }
  if (q.includes("go to upload") || q.includes("open upload")) {
    const res = copilotTools.goToUpload(context);
    return makeResponse(res);
  }

  // 2. Graph trace/zoom node extraction
  const traceMatch = q.match(/(?:trace money from|trace money|trace)\s+(acc-\d+)/i);
  if (traceMatch) {
    const nodeId = traceMatch[1].toUpperCase();
    const res = copilotTools.traceMoneyFlow(context, nodeId);
    return makeResponse(res, ["Explain this node", "Show counterparties", "Reset graph"]);
  }

  const zoomMatch = q.match(/(?:zoom to node|zoom to|zoom|focus node|focus)\s+(acc-\d+)/i);
  if (zoomMatch) {
    const nodeId = zoomMatch[1].toUpperCase();
    const res = copilotTools.zoomToNode(context, nodeId);
    return makeResponse(res, ["Trace money", "Explain this node"]);
  }

  const highlightMatch = q.match(/(?:highlight node|highlight)\s+(acc-\d+)/i);
  if (highlightMatch) {
    const nodeId = highlightMatch[1].toUpperCase();
    const res = copilotTools.highlightNode(context, nodeId);
    return makeResponse(res, ["Trace money", "Zoom node"]);
  }

  // 3. Graph general patterns
  if (q.includes("circular transfers") || q.includes("circular flow") || q.includes("circular money") || q.includes("round money") || q.includes("round tripping")) {
    const res = copilotTools.findCircularTransfers(context);
    if (typeof res === 'object') return res;
    return makeResponse(res, ["Reset graph"]);
  }

  if (q.includes("show only suspicious") || q.includes("highlight suspicious") || q.includes("highlight high risk")) {
    const res = copilotTools.showOnlySuspicious(context);
    return makeResponse(res, ["Reset graph"]);
  }

  if (q.includes("reset graph") || q.includes("clear highlights") || q.includes("clear graph")) {
    const res = copilotTools.resetGraph(context);
    return makeResponse(res, ["Trace money", "Show only suspicious"]);
  }

  // 4. Filters
  if (q.includes("filter upi") || q.includes("show only upi") || q.includes("upi only")) {
    const res = copilotTools.filterUPI(context);
    return makeResponse(res, ["Clear filters", "High risk only"]);
  }
  if (q.includes("failed transactions") || q.includes("failed only")) {
    const res = copilotTools.filterFailed(context);
    return makeResponse(res, ["Clear filters"]);
  }
  if (q.includes("credits only") || q.includes("show credits")) {
    const res = copilotTools.filterCredits(context);
    return makeResponse(res, ["Clear filters"]);
  }
  if (q.includes("debits only") || q.includes("show debits")) {
    const res = copilotTools.filterDebits(context);
    return makeResponse(res, ["Clear filters"]);
  }
  if (q.includes("high risk only") || q.includes("filter high risk")) {
    const res = copilotTools.filterHighRisk(context);
    return makeResponse(res, ["Clear filters"]);
  }
  if (q.includes("clear filters") || q.includes("reset filters")) {
    const res = copilotTools.clearFilters(context);
    return makeResponse(res);
  }

  // 5. Investigations & summaries
  if (q.includes("highest risk transaction") || q.includes("find highest risk")) {
    const res = copilotTools.findHighestRiskTransaction(context);
    if (typeof res === 'object') return res;
    return makeResponse(res);
  }
  if (q.includes("largest transfer") || q.includes("largest transaction") || q.includes("find largest")) {
    const res = copilotTools.findLargestTransfer(context);
    if (typeof res === 'object') return res;
    return makeResponse(res);
  }
  if (q.includes("repeated beneficiaries") || q.includes("repeated receivers")) {
    const res = copilotTools.findRepeatedBeneficiaries(context);
    if (typeof res === 'object') return res;
    return makeResponse(res);
  }
  if (q.includes("dormant accounts") || q.includes("find dormant")) {
    const res = copilotTools.findDormantAccounts(context);
    if (typeof res === 'object') return res;
    return makeResponse(res);
  }
  if (q.includes("summarize timeline") || q.includes("timeline summary")) {
    const res = copilotTools.summarizeTimeline(context);
    if (typeof res === 'object') return res;
    return makeResponse(res);
  }
  if (q.includes("summarize investigation") || q.includes("executive summary") || q.includes("case summary")) {
    const res = copilotTools.summarizeInvestigation(context);
    if (typeof res === 'object') return res;
    return makeResponse(res);
  }
  if (q.includes("calculate money flow") || q.includes("money flow statistics")) {
    const res = copilotTools.calculateMoneyFlow(context);
    if (typeof res === 'object') return res;
    return makeResponse(res);
  }

  // Not handled by direct tool router, pass through to Ollama
  return null;
};

// Helper to construct structured responses
const makeResponse = (answerText, followUps = []) => {
  return {
    sender: 'assistant',
    structured: true,
    data: {
      answer: answerText,
      evidence: [],
      confidence: 100,
      sources: ["Sentinel Client Core"],
      suggested_actions: [],
      follow_up_questions: followUps.length > 0 ? followUps : [
        "Explain this investigation",
        "Why is this suspicious?",
        "Trace money flow"
      ]
    }
  };
};
