/**
 * Graph Enhancements for Hackathon Demo
 * Implements: Circular Money Traversal, Money Trail Animation, Search & Focus, Better Styling
 */

export class CircularFlowHighlighter {
  constructor(cy) {
    this.cy = cy;
    this.highlightedElements = new Set();
    this.animationFrames = [];
  }

  /**
   * Highlight a circular flow pattern
   * @param {Array} accounts - Accounts in the cycle (e.g., ['A', 'B', 'C', 'D', 'A'])
   * @param {Number} totalAmount - Total amount flowing through cycle
   * @param {Number} hopCount - Number of hops
   * @param {Number} duration - Duration in days
   * @param {Number} confidence - Confidence score (0-100)
   */
  highlightCircularFlow(accounts, totalAmount, hopCount, duration, confidence) {
    this.clearHighlight();

    // Fade all nodes except those in the cycle
    const cycleNodeIds = new Set(accounts.filter((acc, idx) => idx < accounts.length - 1).map(String));

    this.cy.nodes().forEach(node => {
      if (!cycleNodeIds.has(String(node.id()))) {
        node.style('opacity', 0.2);
      } else {
        node.style('opacity', 1);
        this.highlightedElements.add(node.id());
      }
    });

    // Fade all edges except those in the cycle
    this.cy.edges().forEach(edge => {
      const source = String(edge.source().id());
      const target = String(edge.target().id());

      let isInCycle = false;
      for (let i = 0; i < accounts.length - 1; i++) {
        if (String(accounts[i]) === source && String(accounts[i + 1]) === target) {
          isInCycle = true;
          break;
        }
      }

      if (isInCycle) {
        edge.style({
          'line-color': '#ff6b6b',
          'target-arrow-color': '#ff6b6b',
          'width': 4,
          'opacity': 1
        });
        this.highlightedElements.add(edge.id());
      } else {
        edge.style('opacity', 0.1);
      }
    });

    // Animate the flow around the cycle
    this.animateFlow(accounts);

    return {
      accounts: accounts.slice(0, -1),
      totalAmount,
      hopCount,
      duration,
      confidence
    };
  }

  /**
   * Animate money flowing through the circular path
   */
  animateFlow(accounts) {
    // Clear previous animations
    this.animationFrames.forEach(frameId => cancelAnimationFrame(frameId));
    this.animationFrames = [];

    const cycleLength = accounts.length - 1;
    let currentIndex = 0;

    const animate = () => {
      // Pulse the current edge
      const currentAccount = String(accounts[currentIndex]);
      const nextAccount = String(accounts[(currentIndex + 1) % accounts.length]);

      this.cy.edges().forEach(edge => {
        const source = String(edge.source().id());
        const target = String(edge.target().id());

        if (source === currentAccount && target === nextAccount) {
          // Pulse effect
          edge.animate({
            style: { 'width': 6 }
          }, { duration: 300 });

          setTimeout(() => {
            edge.animate({
              style: { 'width': 4 }
            }, { duration: 300 });
          }, 300);
        }
      });

      currentIndex = (currentIndex + 1) % cycleLength;
      const frameId = setTimeout(animate, 800);
      this.animationFrames.push(frameId);
    };

    animate();
  }

  clearHighlight() {
    this.animationFrames.forEach(frameId => clearTimeout(frameId));
    this.animationFrames = [];

    this.cy.nodes().style('opacity', 1);
    this.cy.edges().forEach(edge => {
      edge.style({
        'opacity': 1,
        'width': null,
        'line-color': null,
        'target-arrow-color': null
      });
    });

    this.highlightedElements.clear();
  }
}

export class MoneyTrailAnimator {
  constructor(cy) {
    this.cy = cy;
    this.animationFrames = [];
  }

  /**
   * Animate money trail from origin to destination
   * @param {Array} accounts - Account path
   * @param {Array} amounts - Amounts at each step
   * @param {Number} totalAmount - Total amount
   */
  animateMoneyTrail(accounts, amounts, totalAmount) {
    this.clearAnimation();

    // Fade all nodes except those in the trail
    const trailNodeIds = new Set(accounts.map(String));

    this.cy.nodes().forEach(node => {
      if (!trailNodeIds.has(String(node.id()))) {
        node.style('opacity', 0.2);
      } else {
        node.style('opacity', 1);
      }
    });

    // Animate edges sequentially
    let edgeIndex = 0;
    const animateNextEdge = () => {
      if (edgeIndex >= accounts.length - 1) return;

      const source = String(accounts[edgeIndex]);
      const target = String(accounts[edgeIndex + 1]);

      // Find and highlight the edge
      const edge = this.cy.edges().filter(e =>
        String(e.source().id()) === source && String(e.target().id()) === target
      )[0];

      if (edge) {
        edge.style({
          'line-color': '#4ecdc4',
          'target-arrow-color': '#4ecdc4',
          'width': 5,
          'opacity': 1,
          'z-index': 1000
        });

        // Highlight the destination node with glow effect
        const targetNode = this.cy.getElementById(target);
        targetNode.style({
          'border-width': 4,
          'border-color': '#4ecdc4',
          'box-shadow': '0 0 20px #4ecdc4',
          'overlay-color': '#4ecdc4',
          'overlay-opacity': 0.3
        });
      }

      edgeIndex++;
      const frameId = setTimeout(animateNextEdge, 600);
      this.animationFrames.push(frameId);
    };

    animateNextEdge();
  }

  clearAnimation() {
    this.animationFrames.forEach(frameId => clearTimeout(frameId));
    this.animationFrames = [];

    this.cy.nodes().style({
      'opacity': 1,
      'border-width': null,
      'border-color': null,
      'box-shadow': null,
      'overlay-color': null,
      'overlay-opacity': null
    });

    this.cy.edges().forEach(edge => {
      edge.style({
        'opacity': 1,
        'width': null,
        'line-color': null,
        'target-arrow-color': null,
        'z-index': 'auto'
      });
    });
  }
}

export class GraphSearcher {
  constructor(cy) {
    this.cy = cy;
    this.currentMatch = null;
  }

  /**
   * Search for an account and focus on it
   */
  search(query) {
    const lowerQuery = query.toLowerCase();

    // Find matching node
    const matchingNode = this.cy.nodes().filter(node => {
      const id = String(node.id()).toLowerCase();
      const name = (node.data('name') || '').toLowerCase();
      const accountId = (node.data('accountId') || '').toLowerCase();
      const upi = (node.data('upi') || '').toLowerCase();

      return id.includes(lowerQuery) ||
             name.includes(lowerQuery) ||
             accountId.includes(lowerQuery) ||
             upi.includes(lowerQuery);
    })[0];

    if (!matchingNode) return null;

    this.currentMatch = matchingNode;

    // Clear previous highlights
    this.cy.nodes().style({
      'border-width': null,
      'border-color': null
    });

    this.cy.edges().style({
      'line-color': null,
      'target-arrow-color': null,
      'width': null
    });

    // Highlight the matched node
    matchingNode.style({
      'border-width': 3,
      'border-color': '#ffd700',
      'background-color': '#ffed4e'
    });

    // Highlight immediate neighbors
    matchingNode.connectedEdges().forEach(edge => {
      edge.style({
        'line-color': '#ffd700',
        'target-arrow-color': '#ffd700',
        'width': 3
      });

      const otherNode = edge.source().id() === matchingNode.id() ?
        edge.target() : edge.source();

      otherNode.style({
        'border-width': 2,
        'border-color': '#ffb700'
      });
    });

    // Zoom to node
    this.cy.animate({
      center: { eles: matchingNode },
      zoom: 2
    }, { duration: 500 });

    return matchingNode.data();
  }

  clearSearch() {
    this.cy.nodes().style({
      'border-width': null,
      'border-color': null,
      'background-color': null
    });

    this.cy.edges().style({
      'line-color': null,
      'target-arrow-color': null,
      'width': null
    });

    this.currentMatch = null;
  }
}

export class GraphStyler {
  constructor(cy) {
    this.cy = cy;
  }

  /**
   * Apply enhanced styling to the graph
   * @param {Object} nodeMetadata - Map of node IDs to {volume, riskScore, type}
   */
  applyEnhancedStyling(nodeMetadata) {
    // Get max volume for scaling
    const maxVolume = Math.max(
      ...Object.values(nodeMetadata).map(m => m.volume || 0),
      1
    );

    // Style nodes
    this.cy.nodes().forEach(node => {
      const meta = nodeMetadata[node.id()] || { volume: 0, riskScore: 0, type: 'account' };

      // Node size based on volume
      const sizeScale = (meta.volume || 0) / maxVolume;
      const minSize = 25;
      const maxSize = 65;
      const nodeSize = minSize + (sizeScale * (maxSize - minSize));

      node.style('width', nodeSize);
      node.style('height', nodeSize);
      node.style('font-size', Math.max(10, nodeSize * 0.4));

      // Node color based on risk and type
      let bgColor = '#6b7280'; // Gray - normal
      let borderColor = '#4b5563';

      if (meta.type === 'bank') {
        bgColor = '#3b82f6';
        borderColor = '#1e40af';
      } else if (meta.type === 'merchant') {
        bgColor = '#a855f7';
        borderColor = '#6b21a8';
      } else if (meta.type === 'upi') {
        bgColor = '#14b8a6';
        borderColor = '#0d6e6e';
      } else {
        // Risk-based color for normal accounts
        const risk = meta.riskScore || 0;
        if (risk >= 70) {
          bgColor = '#dc2626';
          borderColor = '#7f1d1d';
        } else if (risk >= 50) {
          bgColor = '#f97316';
          borderColor = '#7c2d12';
        } else if (risk >= 30) {
          bgColor = '#eab308';
          borderColor = '#713f12';
        } else {
          bgColor = '#22c55e';
          borderColor = '#166534';
        }
      }

      node.style({
        'background-color': bgColor,
        'border-color': borderColor,
        'border-width': 2
      });
    });

    // Style edges
    const maxEdgeAmount = Math.max(
      ...this.cy.edges().map(e => e.data('amount') || 0),
      1
    );

    this.cy.edges().forEach(edge => {
      const amount = edge.data('amount') || 0;
      const sizeScale = amount / maxEdgeAmount;
      const minWidth = 1;
      const maxWidth = 5;
      const edgeWidth = minWidth + (sizeScale * (maxWidth - minWidth));

      edge.style('width', edgeWidth);

      // Edge color based on amount (subtle gradient)
      let edgeColor = '#cbd5e1';
      if (amount > maxEdgeAmount * 0.7) {
        edgeColor = '#f87171'; // Red for large
      } else if (amount > maxEdgeAmount * 0.4) {
        edgeColor = '#fbbf24'; // Amber for medium-large
      } else if (amount > maxEdgeAmount * 0.1) {
        edgeColor = '#60a5fa'; // Blue for medium
      }

      edge.style({
        'line-color': edgeColor,
        'target-arrow-color': edgeColor
      });
    });
  }

  /**
   * Add hover labels for edges showing amount
   */
  enableEdgeLabelsOnHover() {
    this.cy.on('mouseover', 'edge', (evt) => {
      const edge = evt.target;
      const amount = edge.data('amount');
      const formatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0
      }).format(amount || 0);

      edge.style({
        'label': formatted,
        'font-size': 12,
        'text-background-color': '#1f2937',
        'text-background-opacity': 0.9,
        'text-background-padding': '4px',
        'color': '#fff',
        'z-index': 1000
      });
    });

    this.cy.on('mouseout', 'edge', (evt) => {
      evt.target.style('label', '');
    });
  }
}
