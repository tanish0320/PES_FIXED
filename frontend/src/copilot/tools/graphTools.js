export const graphTools = {
  highlightNode: (context, nodeId) => {
    if (context.toolHandlers.highlightNode) {
      context.toolHandlers.highlightNode(nodeId);
      return `Highlighted node ${nodeId} on the graph canvas.`;
    }
    return "Graph canvas is not active. Switch to the Graph page.";
  },

  highlightNodes: (context, nodeIds) => {
    if (context.toolHandlers.highlightNodes) {
      context.toolHandlers.highlightNodes(nodeIds);
      return `Focused and highlighted nodes: ${nodeIds.join(', ')}.`;
    }
    return "Graph canvas is not active.";
  },

  highlightPattern: (context, patternType) => {
    if (context.toolHandlers.highlightPattern) {
      context.toolHandlers.highlightPattern(patternType);
      return `Highlighted detected ${patternType} patterns on the graph structure.`;
    }
    // Fallback: call highlightSuspicious or trace depending on pattern
    if (context.toolHandlers.showOnlySuspicious) {
      context.toolHandlers.showOnlySuspicious();
      return `Highlighted high risk elements on the graph structure.`;
    }
    return "Graph canvas is not active.";
  },

  highlightPath: (context, pathNodeIds) => {
    if (context.toolHandlers.highlightNodes) {
      context.toolHandlers.highlightNodes(pathNodeIds);
      return `Highlighted flow path through nodes: ${pathNodeIds.join(' -> ')}.`;
    }
    return "Graph canvas is not active.";
  },

  traceMoneyFlow: (context, accountId) => {
    if (context.toolHandlers.traceMoneyFlow) {
      context.toolHandlers.traceMoneyFlow(accountId);
      return `Initiated money trail flow tracing from account ${accountId}.`;
    }
    return "Money trail tracing unavailable (graph is not active).";
  },

  expandNetwork: (context, nodeId) => {
    if (context.toolHandlers.expandNetwork) {
      context.toolHandlers.expandNetwork(nodeId);
      return `Expanded connection network around node ${nodeId}.`;
    }
    return "Expand network is unavailable.";
  },

  collapseNetwork: (context) => {
    if (context.toolHandlers.resetGraph) {
      context.toolHandlers.resetGraph();
      return "Collapsed expanded connections and reset layout.";
    }
    return "Graph reset unavailable.";
  },

  zoomToNode: (context, nodeId) => {
    if (context.toolHandlers.zoomToNode) {
      context.toolHandlers.zoomToNode(nodeId);
      return `Zoomed in on node ${nodeId}.`;
    }
    if (context.toolHandlers.highlightNode) {
      context.toolHandlers.highlightNode(nodeId);
      return `Highlighted node ${nodeId}.`;
    }
    return "Graph zoom unavailable.";
  },

  centerGraph: (context) => {
    if (context.toolHandlers.centerGraph) {
      context.toolHandlers.centerGraph();
      return "Centered graph canvas view.";
    }
    if (context.toolHandlers.resetGraph) {
      context.toolHandlers.resetGraph();
      return "Reset graph highlights and layout.";
    }
    return "Graph canvas unavailable.";
  },

  selectTransaction: (context, txId) => {
    if (context.toolHandlers.selectTransaction) {
      context.toolHandlers.selectTransaction(txId);
      return `Selected and highlighted transaction ${txId}.`;
    }
    return "Transaction selection unavailable.";
  },

  focusCase: (context, caseId) => {
    context.setSelectedCase(caseId);
    if (context.toolHandlers.navigate) {
      context.toolHandlers.navigate(`/graph/${caseId}`);
      return `Switched active focus to Case ${caseId}.`;
    }
    return `Set active case to ${caseId}.`;
  },

  showNeighbours: (context, nodeId) => {
    if (context.toolHandlers.expandNetwork) {
      context.toolHandlers.expandNetwork(nodeId);
      return `Showing immediate counterparties for node ${nodeId}.`;
    }
    return "Neighborhood view unavailable.";
  },

  showOnlySuspicious: (context) => {
    if (context.toolHandlers.showOnlySuspicious) {
      context.toolHandlers.showOnlySuspicious();
      return "Filtered graph view to highlight suspicious accounts (Risk Score >= 60).";
    }
    return "Suspicious filter unavailable.";
  },

  resetGraph: (context) => {
    if (context.toolHandlers.resetGraph) {
      context.toolHandlers.resetGraph();
      return "Cleared all highlights and reset graph canvas styles.";
    }
    return "Graph reset unavailable.";
  }
};
