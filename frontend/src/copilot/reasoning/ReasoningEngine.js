// SENTINEL client-side Autonomous Investigation & Explainable AI Reasoning Engine
// Computes advanced graph analytics, transaction trends, and groups counterparties.

export const ReasoningEngine = {
  
  // Primary entrypoint to analyze active investigation data
  analyze: (context) => {
    const nodes = context.graphState?.nodes || [];
    const edges = context.graphState?.edges || [];
    const timeline = context.currentTimeline || [];
    const report = context.selectedReport || {};

    if (nodes.length === 0) {
      return {
        status: "empty",
        message: "No active investigation loaded."
      };
    }

    // 1. Advanced Graph Analytics
    const graphAnalytics = computeGraphAnalytics(nodes, edges);

    // 2. Entity Intelligence
    const entitiesGrouped = groupAndAnalyzeEntities(nodes, edges);

    // 3. Suspicious Indicators & Patterns
    const indicators = detectSuspiciousIndicators(nodes, edges, graphAnalytics);

    // 4. Group into Investigation Chains
    const chains = compileInvestigationChains(nodes, edges, graphAnalytics);

    // 5. Generate Recommendations
    const recommendations = generateRecommendations(nodes, edges, graphAnalytics, indicators);

    // 6. Executive Brief parameters
    const totalVolume = edges.reduce((sum, e) => sum + Number(e.data?.amount || e.amount || 0), 0);
    const avgAmount = edges.length > 0 ? (totalVolume / edges.length) : 0;
    const maxRisk = nodes.reduce((max, n) => Math.max(max, Number(n.data?.risk || n.risk || 0)), 0);

    return {
      status: "analyzed",
      caseId: context.selectedCase,
      metrics: {
        totalAccounts: nodes.length,
        totalTransactions: edges.length,
        monitoredVolume: totalVolume,
        averageTransaction: avgAmount,
        maxRisk: maxRisk
      },
      analytics: graphAnalytics,
      entities: entitiesGrouped,
      indicators: indicators,
      chains: chains,
      recommendations: recommendations
    };
  }
};

// Helper 1: Compute Graph Degree and Flow Characteristics
function computeGraphAnalytics(nodes, edges) {
  const adj = {};
  const revAdj = {};
  const indegrees = {};
  const outdegrees = {};
  const netFlow = {}; // net inflows - outflows
  const nodeMap = {};

  nodes.forEach(n => {
    const id = String(n.data?.id || n.id || n.data?.account_id);
    adj[id] = [];
    revAdj[id] = [];
    indegrees[id] = 0;
    outdegrees[id] = 0;
    netFlow[id] = 0;
    nodeMap[id] = n.data || n;
  });

  edges.forEach(e => {
    const tx = e.data || e;
    const src = String(tx.source || tx.from);
    const tgt = String(tx.target || tx.to);
    const amt = Number(tx.amount || 0);

    if (adj[src]) {
      adj[src].push({ target: tgt, amount: amt, id: tx.id || tx.transaction_id });
      outdegrees[src]++;
      netFlow[src] -= amt;
    }
    if (revAdj[tgt]) {
      revAdj[tgt].push({ source: src, amount: amt, id: tx.id || tx.transaction_id });
      indegrees[tgt]++;
      netFlow[tgt] += amt;
    }
  });

  // Calculate most central, sources, sinks, bridges
  let centralNode = null;
  let maxDegree = -1;

  let moneySource = null;
  let maxSourceFlow = 1e9; // Most negative netflow

  let moneySink = null;
  let maxSinkFlow = -1; // Most positive netflow

  const bridgeAccounts = [];

  Object.keys(nodeMap).forEach(id => {
    const degree = indegrees[id] + outdegrees[id];
    if (degree > maxDegree) {
      maxDegree = degree;
      centralNode = id;
    }

    const flow = netFlow[id];
    if (flow < maxSourceFlow) {
      maxSourceFlow = flow;
      moneySource = id;
    }
    if (flow > maxSinkFlow) {
      maxSinkFlow = flow;
      moneySink = id;
    }

    if (indegrees[id] > 0 && outdegrees[id] > 0) {
      bridgeAccounts.push(id);
    }
  });

  // Detect cycle paths (circular flows)
  const visited = {};
  const recStack = {};
  const circularPaths = [];

  const dfs = (curr, path) => {
    visited[curr] = true;
    recStack[curr] = true;
    path.push(curr);

    const neighbors = adj[curr] || [];
    for (const edge of neighbors) {
      const next = edge.target;
      if (!visited[next]) {
        if (dfs(next, path)) return true;
      } else if (recStack[next]) {
        const idx = path.indexOf(next);
        if (idx !== -1) {
          circularPaths.push([...path.slice(idx), next]);
        }
      }
    }

    recStack[curr] = false;
    path.pop();
    return false;
  };

  Object.keys(adj).forEach(id => {
    if (!visited[id]) {
      dfs(id, []);
    }
  });

  return {
    indegrees,
    outdegrees,
    netFlow,
    centralNode: { id: centralNode, label: nodeMap[centralNode]?.label || centralNode },
    moneySource: { id: moneySource, flow: Math.abs(maxSourceFlow) },
    moneySink: { id: moneySink, flow: maxSinkFlow },
    bridgeAccounts,
    circularPaths
  };
}

// Helper 2: Group entities automatically
function groupAndAnalyzeEntities(nodes, edges) {
  const persons = [];
  const banks = {};
  const merchants = {};
  const upis = [];

  nodes.forEach(n => {
    const nd = n.data || n;
    const type = String(nd.node_type || nd.type || 'account').toLowerCase();
    const id = nd.id || nd.account_id;

    if (type === 'person' || type === 'entity') {
      persons.push(id);
    }
    
    // Group banks from IFSC
    const ifsc = String(nd.ifsc || '').slice(0, 4).toUpperCase();
    if (ifsc) {
      banks[ifsc] = (banks[ifsc] || 0) + Number(nd.total_inflow || 0);
    }
  });

  edges.forEach(e => {
    const tx = e.data || e;
    const channel = String(tx.channel || '').toUpperCase();
    const desc = String(tx.description || '').toUpperCase();

    if (channel === 'UPI') {
      upis.push(tx.id || tx.transaction_id);
    }
    if (desc.includes("MERCHANT") || desc.includes("PAYTM") || desc.includes("RAZORPAY")) {
      const word = desc.split(' ').find(w => w.includes("MERCH") || w.includes("PAY") || w.includes("BILL")) || "GENERIC MERCHANT";
      merchants[word] = (merchants[word] || 0) + Number(tx.amount || 0);
    }
  });

  return {
    persons,
    banks: Object.entries(banks).map(([name, vol]) => ({ name, volume: vol })),
    merchants: Object.entries(merchants).map(([name, vol]) => ({ name, volume: vol })),
    upisCount: upis.length
  };
}

// Helper 3: Detect dynamic indicators
function detectSuspiciousIndicators(nodes, edges, analytics) {
  const indicators = {
    hasCircularFlow: analytics.circularPaths.length > 0,
    hasDormantActivation: false,
    hasStructuring: false,
    hasLayering: false
  };

  // Dormant activation indicator (e.g. single transfer representing > 80% of net volume)
  nodes.forEach(n => {
    const nd = n.data || n;
    const id = nd.id || nd.account_id;
    const inEdges = edges.filter(e => (e.data?.target || e.target) === id);
    if (inEdges.length === 1) {
      const amt = Number(inEdges[0].data?.amount || inEdges[0].amount || 0);
      if (amt >= 500000 && Number(nd.risk || 0) >= 60) {
        indicators.hasDormantActivation = true;
      }
    }
  });

  // Layering indicator (e.g. bridge nodes routing incoming transfers out within close margins)
  analytics.bridgeAccounts.forEach(bridgeId => {
    const outEdges = edges.filter(e => (e.data?.source || e.source) === bridgeId);
    const inEdges = edges.filter(e => (e.data?.target || e.target) === bridgeId);
    
    inEdges.forEach(inE => {
      const inAmt = Number(inE.data?.amount || inE.amount || 0);
      outEdges.forEach(outE => {
        const outAmt = Number(outE.data?.amount || outE.amount || 0);
        // If funds matching within 10% are forwarded
        if (Math.abs(inAmt - outAmt) / inAmt <= 0.1) {
          indicators.hasLayering = true;
        }
      });
    });
  });

  // Structuring detection (e.g. repeated transfers just below 50,000 RBI reporting limits)
  const structuringTransfers = edges.filter(e => {
    const amt = Number(e.data?.amount || e.amount || 0);
    return amt >= 45000 && amt < 50000;
  });
  if (structuringTransfers.length >= 3) {
    indicators.hasStructuring = true;
  }

  return indicators;
}

// Helper 4: Compile findings into structural Investigation Chains
function compileInvestigationChains(nodes, edges, analytics) {
  const chains = [];

  // Group circular loops
  if (analytics.circularPaths.length > 0) {
    analytics.circularPaths.slice(0, 3).forEach((path, idx) => {
      const chainEdges = [];
      for (let i = 0; i < path.length - 1; i++) {
        const matchingEdge = edges.find(e => {
          const tx = e.data || e;
          return String(tx.source || tx.from) === path[i] && String(tx.target || tx.to) === path[i+1];
        });
        if (matchingEdge) {
          chainEdges.push(matchingEdge.data?.id || matchingEdge.id || matchingEdge.data?.transaction_id);
        }
      }
      chains.push({
        type: "Circular Flow Loop",
        description: `Round-tripping trail detected returning back to originating node **${path[0]}**.`,
        nodes: path,
        edges: chainEdges,
        confidence: 94
      });
    });
  }

  // Group layered flows
  analytics.bridgeAccounts.slice(0, 2).forEach(bridgeId => {
    const inE = edges.find(e => (e.data?.target || e.target) === bridgeId);
    const outE = edges.find(e => (e.data?.source || e.source) === bridgeId);
    if (inE && outE) {
      chains.push({
        type: "Layering Conduit",
        description: `Account **${bridgeId}** acting as routing conduit forwarding **₹${new Intl.NumberFormat('en-IN').format(inE.data?.amount || inE.amount)}** from **${inE.data?.source || inE.source}** to **${outE.data?.target || outE.target}**.`,
        nodes: [inE.data?.source || inE.source, bridgeId, outE.data?.target || outE.target],
        edges: [inE.data?.id || inE.id, outE.data?.id || outE.id],
        confidence: 89
      });
    }
  });

  return chains;
}

// Helper 5: Dynamic Recommendations Generation
function generateRecommendations(nodes, edges, analytics, indicators) {
  const recs = [];
  if (indicators.hasCircularFlow) {
    recs.push("Flag active loop participants for immediate account freezes.");
    recs.push("Request banking logs from participant institutions to confirm ultimate beneficial ownership.");
  }
  if (indicators.hasLayering) {
    recs.push("Investigate the bridge accounts for possible shell registration anomalies.");
  }
  if (indicators.hasStructuring) {
    recs.push("File Suspicious Transaction Reports (STR) for multiple sub-50,000 UPI transfers.");
  }
  if (analytics.moneySource.id) {
    recs.push(`Audit source funding root origins for account **${analytics.moneySource.id}**.`);
  }
  if (analytics.moneySink.id) {
    recs.push(`Submit asset recovery requests against primary money sink **${analytics.moneySink.id}**.`);
  }

  // General defaults
  recs.push("Cross-check repetitively targeted merchant identifiers with corporate databases.");
  
  return recs;
}
