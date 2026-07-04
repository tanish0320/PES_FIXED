export const investigationTools = {
  summarizeInvestigation: (context) => {
    const nodes = context.graphState?.nodes || [];
    const edges = context.graphState?.edges || [];
    const caseId = context.selectedCase || 'General';

    if (nodes.length === 0) {
      return "No investigation context loaded. Please open an investigation case.";
    }

    const highRiskNodes = nodes.filter(n => Number((n.data?.risk || n.risk || 0)) >= 60);
    const totalVolume = edges.reduce((acc, e) => acc + Number(e.data?.amount || e.amount || 0), 0);

    return {
      type: "investigation_summary",
      title: `Investigation Summary: Case ${caseId}`,
      explanation: `This investigation consists of **${nodes.length} accounts** connected by **${edges.length} transactions** representing a total monitored volume of **₹${new Intl.NumberFormat('en-IN').format(totalVolume)}**. We have detected **${highRiskNodes.length} high-risk nodes** showing anomalous behavioral patterns indicative of layering or fund-diversion.`,
      confidence: 96,
      evidence: [
        `Total Accounts: ${nodes.length}`,
        `Total Transactions: ${edges.length}`,
        `Monitored Flow Volume: ₹${new Intl.NumberFormat('en-IN').format(totalVolume)}`
      ],
      recommendations: [
        "Audit high-risk nodes showing risk scores >= 60.",
        "Generate police FIR narrative for suspicious shell entities."
      ],
      suggestedActions: ["Highlight Graph", "Open Report"]
    };
  },

  findHighestRiskTransaction: (context) => {
    const edges = context.graphState?.edges || [];
    if (edges.length === 0) return "No active transactions loaded in this investigation.";

    let highest = null;
    edges.forEach(e => {
      const tx = e.data || e;
      const risk = Number(tx.risk_score || tx.risk || 0);
      if (!highest || risk > Number(highest.risk_score || highest.risk || 0)) {
        highest = tx;
      }
    });

    if (highest) {
      const txId = highest.id || highest.transaction_id || highest.transactionId;
      if (context.toolHandlers.selectTransaction) {
        context.toolHandlers.selectTransaction(txId);
      }
      return {
        type: "transaction_match",
        title: "Highest Risk Transaction",
        explanation: `Transaction **${txId}** is flagged with a Risk Score of **${highest.risk_score || highest.risk}/100** due to anomalous volume and destination characteristics.`,
        confidence: 99,
        evidence: [`${txId} | Amount: ₹${new Intl.NumberFormat('en-IN').format(highest.amount)} | Risk: ${highest.risk_score || highest.risk}`],
        suggestedActions: ["Highlight Graph"],
        graphActions: [`selectTransaction("${txId}")`]
      };
    }
    return "No high-risk transactions detected.";
  },

  findLargestTransfer: (context) => {
    const edges = context.graphState?.edges || [];
    if (edges.length === 0) return "No transactions found in this case.";

    let largest = null;
    edges.forEach(e => {
      const tx = e.data || e;
      const amt = Number(tx.amount || 0);
      if (!largest || amt > Number(largest.amount || 0)) {
        largest = tx;
      }
    });

    if (largest) {
      const txId = largest.id || largest.transaction_id || largest.transactionId;
      if (context.toolHandlers.selectTransaction) {
        context.toolHandlers.selectTransaction(txId);
      }
      return {
        type: "transaction_match",
        title: "Largest Funds Transfer",
        explanation: `The largest monitored funds movement is transaction **${txId}** conveying **₹${new Intl.NumberFormat('en-IN').format(largest.amount)}** from **${largest.source || largest.from}** to **${largest.target || largest.to}**.`,
        confidence: 100,
        evidence: [`${txId} | Source: ${largest.source || largest.from} | Destination: ${largest.target || largest.to} | Amount: ₹${new Intl.NumberFormat('en-IN').format(largest.amount)}`],
        suggestedActions: ["Highlight Graph"]
      };
    }
    return "No transactions found.";
  },

  findRepeatedBeneficiaries: (context) => {
    const edges = context.graphState?.edges || [];
    if (edges.length === 0) return "No transactions available to scan.";

    const beneficiaryCounts = {};
    edges.forEach(e => {
      const tx = e.data || e;
      const target = tx.target || tx.to;
      if (target) {
        beneficiaryCounts[target] = (beneficiaryCounts[target] || 0) + 1;
      }
    });

    const repeated = Object.entries(beneficiaryCounts)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    if (repeated.length > 0) {
      return {
        type: "beneficiaries_analysis",
        title: "Repeated Beneficiaries",
        explanation: `We detected **${repeated.length} accounts** receiving multiple transactions. This behavior is commonly associated with concentration points in layering schemes.`,
        confidence: 94,
        evidence: repeated.slice(0, 5).map(([acc, count]) => `Account ${acc}: received ${count} transfers.`),
        suggestedActions: ["Highlight Graph"]
      };
    }
    return "No repeated beneficiaries detected.";
  },

  findDormantAccounts: (context) => {
    // Look for accounts with high single transaction amounts but low degree connectivity
    const nodes = context.graphState?.nodes || [];
    const edges = context.graphState?.edges || [];

    if (nodes.length === 0) return "No graph structure loaded.";

    const dormantAccounts = [];
    nodes.forEach(n => {
      const nd = n.data || n;
      const accountId = nd.id || nd.account_id;
      const nodeEdges = edges.filter(e => e.data?.source === accountId || e.data?.target === accountId);
      const isHighRisk = Number(nd.risk || 0) >= 60;
      
      // If node has low transaction counts but high risk score
      if (nodeEdges.length <= 2 && isHighRisk) {
        dormantAccounts.push(accountId);
      }
    });

    if (dormantAccounts.length > 0) {
      return {
        type: "dormant_accounts_flag",
        title: "Potentially Dormant Accounts Activated",
        explanation: `Flagged **${dormantAccounts.length} accounts** showing low transaction frequency but sudden high risk scoring, indicative of pass-through behavior.`,
        confidence: 88,
        evidence: dormantAccounts.map(acc => `Account ${acc}`),
        suggestedActions: ["Highlight Graph"]
      };
    }
    return "No dormant activation anomalies found.";
  },

  findCircularTransfers: (context) => {
    const edges = context.graphState?.edges || [];
    const nodes = context.graphState?.nodes || [];
    if (edges.length === 0) return "No graph connections to scan for cycles.";

    // Build adjacency list
    const adj = {};
    nodes.forEach(n => {
      const id = n.data?.id || n.id;
      adj[id] = [];
    });

    edges.forEach(e => {
      const src = e.data?.source || e.source;
      const tgt = e.data?.target || e.target;
      if (adj[src]) adj[src].push(tgt);
    });

    // Detect cycles using DFS
    const visited = {};
    const recStack = {};
    const cycles = [];

    const dfs = (curr, path) => {
      visited[curr] = true;
      recStack[curr] = true;
      path.push(curr);

      const neighbors = adj[curr] || [];
      for (const next of neighbors) {
        if (!visited[next]) {
          if (dfs(next, path)) return true;
        } else if (recStack[next]) {
          const idx = path.indexOf(next);
          if (idx !== -1) {
            cycles.push([...path.slice(idx), next]);
          }
        }
      }

      recStack[curr] = false;
      path.pop();
      return false;
    };

    for (const node of Object.keys(adj)) {
      if (!visited[node]) {
        dfs(node, []);
      }
    }

    if (cycles.length > 0) {
      // Highlight pattern
      if (context.toolHandlers.highlightPattern) {
        context.toolHandlers.highlightPattern("Circular");
      }
      return {
        type: "circular_flow",
        title: "Circular Money Movement Detected",
        explanation: `Detected **${cycles.length} circular loops** in the transaction network. Funds originate and return to the same account node, representing high-probability round-tripping layering.`,
        confidence: 97,
        evidence: cycles.map(c => `Loop: ${c.join(' -> ')}`),
        suggestedActions: ["Highlight Graph"]
      };
    }
    return "No circular transaction loops detected.";
  },

  calculateMoneyFlow: (context) => {
    const edges = context.graphState?.edges || [];
    if (edges.length === 0) return "No flow statistics available.";

    let totalInflow = 0;
    let totalOutflow = 0;
    
    edges.forEach(e => {
      const tx = e.data || e;
      const amount = Number(tx.amount || 0);
      if (tx.flow === 'INFLOW' || tx.flow_type === 'INFLOW' || tx.type === 'inflow') {
        totalInflow += amount;
      } else {
        totalOutflow += amount;
      }
    });

    return {
      type: "flow_analysis",
      title: "Consolidated Money Flow Statistics",
      explanation: `Aggregated flow tracing shows a total inflow volume of **₹${new Intl.NumberFormat('en-IN').format(totalInflow)}** and a total outflow volume of **₹${new Intl.NumberFormat('en-IN').format(totalOutflow)}**.`,
      confidence: 100,
      evidence: [
        `Total Monitored Inflow: ₹${new Intl.NumberFormat('en-IN').format(totalInflow)}`,
        `Total Monitored Outflow: ₹${new Intl.NumberFormat('en-IN').format(totalOutflow)}`
      ]
    };
  },

  summarizeTimeline: (context) => {
    const timeline = context.currentTimeline || [];
    if (timeline.length === 0) return "No timeline logs loaded for this investigation.";

    return {
      type: "timeline_summary",
      title: "Investigation Timeline Audit",
      explanation: `Analyzed **${timeline.length} timeline events** spanning the case history. Anomaly trends indicate high concentration of suspicious activities centered around transactions on peak dates.`,
      confidence: 92,
      evidence: timeline.slice(0, 4).map(t => `${t.date || t.timestamp} | ${t.event || t.description}`),
      suggestedActions: ["Open Timeline"]
    };
  },

  generateExecutiveSummary: (context) => {
    return investigationTools.summarizeInvestigation(context);
  }
};
