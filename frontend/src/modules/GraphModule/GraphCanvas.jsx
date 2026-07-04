import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import cytoscape from 'cytoscape';
import { graphStyles, getRiskColors } from './graphStyles';
import { getRole } from '../../roleStore';
import { maskAccount } from '../../utils/maskAccount';
import { MoneyTrailAnimator } from './GraphEnhancements';

const formatTransactionLabel = (edge) => {
  const amount = Number(edge.amount || 0);
  const channel = edge.channel || 'OTHER';
  const formattedAmount = new Intl.NumberFormat('en-IN').format(amount);
  return `\u20B9${formattedAmount} via ${channel}`;
};

const getGraphBounds = (container) => {
  const width = container?.clientWidth || 800;
  const height = container?.clientHeight || 600;
  const padding = Math.max(36, Math.min(70, Math.floor(Math.min(width, height) * 0.09)));

  return { width, height, padding };
};

const getNodeDepths = (nodes, edges) => {
  const ids = nodes.map((node) => String(node.accountId || node.id));
  const indegree = new Map(ids.map((id) => [id, 0]));
  const children = new Map(ids.map((id) => [id, []]));

  edges.forEach((edge) => {
    const source = String(edge.source || edge.from);
    const target = String(edge.target || edge.to);
    if (!indegree.has(source) || !indegree.has(target)) return;
    indegree.set(target, indegree.get(target) + 1);
    children.get(source).push(target);
  });

  const depths = new Map();
  let queue = ids.filter((id) => indegree.get(id) === 0);
  if (queue.length === 0 && ids.length > 0) queue = [ids[0]];

  queue.forEach((id) => depths.set(id, 0));

  while (queue.length > 0) {
    const id = queue.shift();
    const nextDepth = (depths.get(id) || 0) + 1;
    children.get(id)?.forEach((childId) => {
      if (!depths.has(childId) || nextDepth > depths.get(childId)) {
        depths.set(childId, nextDepth);
        queue.push(childId);
      }
    });
  }

  ids.forEach((id) => {
    if (!depths.has(id)) depths.set(id, 0);
  });

  return depths;
};

const positionNode = (cy, id, position, animate) => {
  const node = cy.getElementById(id);
  if (node.length === 0) return;

  if (animate) {
    node.stop();
    node.animate({ position }, { duration: 450 });
  } else {
    node.position(position);
  }
};

const applyDenseGridLayout = (cy, orderedIds, container, animate) => {
  const { width, height, padding } = getGraphBounds(container);
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);
  const aspect = usableWidth / usableHeight;
  const columns = Math.max(1, Math.ceil(Math.sqrt(orderedIds.length * aspect)));
  const rows = Math.max(1, Math.ceil(orderedIds.length / columns));

  orderedIds.forEach((id, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = padding + (usableWidth * (column + 1)) / (columns + 1);
    const y = padding + (usableHeight * (row + 1)) / (rows + 1);
    positionNode(cy, id, { x, y }, animate);
  });
};

const shouldUseDenseGrid = (columns, usableWidth, usableHeight) => {
  const minReadableXGap = 96;
  const minReadableYGap = 86;
  const maxRows = Math.max(...Array.from(columns.values(), (ids) => ids.length), 1);
  const xGap = usableWidth / Math.max(columns.size - 1, 1);
  const yGap = usableHeight / Math.max(maxRows + 1, 1);

  return columns.size > 7 || xGap < minReadableXGap || yGap < minReadableYGap;
};

const applyDashboardLayout = (cy, nodes, edges, container, animate) => {
  const { width, height, padding } = getGraphBounds(container);
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);
  const depths = getNodeDepths(nodes, edges);
  const columns = new Map();

  nodes.forEach((node) => {
    const id = String(node.accountId || node.id || node.account_id);
    const depth = depths.get(id) || 0;
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth).push(id);
  });

  const sortedDepths = Array.from(columns.keys()).sort((a, b) => a - b);
  const orderedIds = sortedDepths.flatMap((depth) => columns.get(depth).sort());

  if (shouldUseDenseGrid(columns, usableWidth, usableHeight)) {
    applyDenseGridLayout(cy, orderedIds, container, animate);
    return;
  }

  const lastColumnIndex = Math.max(sortedDepths.length - 1, 1);

  sortedDepths.forEach((depth, columnIndex) => {
    const ids = columns.get(depth).sort();
    ids.forEach((id, rowIndex) => {
      const x = padding + (usableWidth * columnIndex) / lastColumnIndex;
      const y = padding + (usableHeight * (rowIndex + 1)) / (ids.length + 1);
      positionNode(cy, id, { x, y }, animate);
    });
  });
};

const layoutConfig = {
  name: 'cose',
  idealEdgeLength: 120,
  nodeOverlap: 20,
  refresh: 20,
  fit: true,
  padding: 50,
  randomize: true,
  componentSpacing: 100,
  nodeRepulsion: 400000,
  edgeElasticity: 100,
  nestingFactor: 5,
  gravity: 80,
  numIter: 1000,
  initialTemp: 200,
  coolingFactor: 0.95,
  minTemp: 1.0,
  animate: true
};

const isNodeInViewport = (cy, node) => {
  const rect = node.boundingBox();
  const extent = cy.extent();
  return (
    rect.x1 >= extent.x1 &&
    rect.x2 <= extent.x2 &&
    rect.y1 >= extent.y1 &&
    rect.y2 <= extent.y2
  );
};

const animateEdgeGrowth = (cy, edgeId, sourceId, targetId, duration, playbackSpeed = 0.5) => {
  const sourceNode = cy.getElementById(sourceId);
  const targetNode = cy.getElementById(targetId);
  const realEdge = cy.getElementById(edgeId);

  if (sourceNode.length === 0 || targetNode.length === 0 || realEdge.length === 0) {
    return Promise.resolve();
  }

  const startPos = sourceNode.position();
  const endPos = targetNode.position();

  const dummyNodeId = `dummy-head-${edgeId}`;
  const dummyEdgeId = `dummy-edge-${edgeId}`;

  // Add a helper node that travels along the edge (moving glow)
  cy.add({
    group: 'nodes',
    data: { id: dummyNodeId },
    position: { ...startPos },
    style: {
      'width': 8,
      'height': 8,
      'background-color': '#f59e0b',
      'border-width': 0,
      'opacity': 1,
      'z-index': 200,
      'events': 'no',
      'overlay-opacity': 0
    }
  });

  // Add dummy edge connecting source and helper node
  cy.add({
    group: 'edges',
    data: {
      id: dummyEdgeId,
      source: sourceId,
      target: dummyNodeId
    },
    style: {
      'line-color': '#f59e0b',
      'width': 3,
      'target-arrow-shape': 'none',
      'opacity': 0.8,
      'curve-style': 'bezier',
      'z-index': 190,
      'events': 'no'
    }
  });

  const dummyNode = cy.getElementById(dummyNodeId);
  const dummyEdge = cy.getElementById(dummyEdgeId);

  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    const safetyTimeout = setTimeout(() => {
      try {
        if (cy.getElementById(dummyNodeId).length > 0) cy.remove(cy.getElementById(dummyNodeId));
        if (cy.getElementById(dummyEdgeId).length > 0) cy.remove(cy.getElementById(dummyEdgeId));
        const pulseId = `pulse-${edgeId}`;
        if (cy.getElementById(pulseId).length > 0) cy.remove(cy.getElementById(pulseId));
        realEdge.removeClass('hidden-replay');
        realEdge.css({ opacity: 1 });
      } catch (err) {}
      safeResolve();
    }, (duration * 2.5) + 800);

    dummyNode.animate({
      position: endPos
    }, {
      duration: duration,
      easing: 'ease-out-quad',
      complete: () => {
        cy.remove(dummyNode);
        cy.remove(dummyEdge);

        // Reveal the real edge with a smooth fade in
        realEdge.removeClass('hidden-replay');
        realEdge.css({ opacity: 0 });
        realEdge.animate({
          style: { opacity: 1 }
        }, {
          duration: 200 / playbackSpeed,
          complete: () => {
            // Animate a second, subtle glowing pulse travelling from sender to receiver
            const pulseNodeId = `pulse-${edgeId}`;
            cy.add({
              group: 'nodes',
              data: { id: pulseNodeId },
              position: { ...startPos },
              style: {
                'width': 6,
                'height': 6,
                'background-color': '#f59e0b',
                'border-width': 0,
                'opacity': 0.9,
                'z-index': 210,
                'events': 'no',
                'overlay-opacity': 0
              }
            });

            const pulseNode = cy.getElementById(pulseNodeId);
            pulseNode.animate({
              position: endPos
            }, {
              duration: 350 / playbackSpeed, // fast, clean pulse representing money movement
              easing: 'ease-in-out-quad',
              complete: () => {
                cy.remove(pulseNode);
                clearTimeout(safetyTimeout);
                safeResolve();
              }
            });
          }
        });
      }
    });
  });
};

const GraphCanvas = forwardRef(({ 
  nodes = [], 
  edges = [], 
  onNodeClick, 
  replayMode = false, 
  primaryAccountId = '' 
}, ref) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const isInitializedRef = useRef(false);
  const onNodeClickRef = useRef(onNodeClick);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useImperativeHandle(ref, () => ({
    highlightNode: (nodeId, duration = 1000) => {
      const cy = cyRef.current;
      if (!cy) return;
      const node = cy.getElementById(nodeId);
      if (node.length > 0) {
        node.animate({
          style: { 'border-width': 10, 'border-color': '#3b82f6' }
        }, {
          duration: 200,
          complete: () => {
            setTimeout(() => {
              node.animate({
                style: {
                  'border-width': 2,
                  'border-color': '#1d4ed8'
                }
              }, { duration: 400 });
            }, duration);
          }
        });
      }
    },
    traceMoneyFlow: (nodeId) => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.elements().removeClass('highlighted');
      if (!nodeId) return;
      const root = cy.getElementById(nodeId);
      if (root.length === 0) return;
      
      cy.elements().bfs({
        roots: root,
        visit: (v, e) => {
          v.addClass('highlighted');
          if (e) e.addClass('highlighted');
        },
        directed: true
      });
    },
    expandNetwork: (nodeId) => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.elements().removeClass('highlighted');
      if (!nodeId) return;
      const root = cy.getElementById(nodeId);
      if (root.length === 0) return;
      
      root.addClass('highlighted');
      const neighbors1 = root.neighborhood();
      neighbors1.addClass('highlighted');
      
      neighbors1.nodes().forEach(n => {
        n.neighborhood().addClass('highlighted');
      });
    },
    highlightSuspicious: (riskThreshold = 60) => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.elements().removeClass('suspicious-flag');
      cy.nodes().forEach(n => {
        const risk = Number(n.data('risk') || 0);
        if (risk >= riskThreshold) {
          n.addClass('suspicious-flag');
          n.connectedEdges().addClass('suspicious-flag');
        }
      });
    },
    clearHighlights: () => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.elements().removeClass('highlighted').removeClass('suspicious-flag');
    },
    highlightMoneyTrail: (txIds, nodeIds) => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.batch(() => {
        cy.elements().removeClass('highlighted-trail').removeClass('dimmed');
        cy.elements().addClass('dimmed');
        
        txIds.forEach(txId => {
          const edge = cy.getElementById(String(txId));
          if (edge.length > 0) {
            edge.removeClass('dimmed').addClass('highlighted-trail');
          }
        });
        
        nodeIds.forEach(nodeId => {
          const node = cy.nodes().filter(n => n.data('account_id') === String(nodeId) || n.id() === String(nodeId));
          if (node.length > 0) {
            node.removeClass('dimmed').addClass('highlighted-trail');
          }
        });
      });
    },
    clearTrailHighlight: () => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.elements().removeClass('highlighted-trail').removeClass('dimmed');
    },
    focusNodes: (nodeIds) => {
      const cy = cyRef.current;
      if (!cy) return;
      const matching = cy.nodes().filter(n => {
        const accId = String(n.data('account_id') || '');
        const id = String(n.id() || '');
        return nodeIds.some(targetId => 
          targetId && (accId.toLowerCase() === String(targetId).toLowerCase() || id.toLowerCase() === String(targetId).toLowerCase())
        );
      });
      if (matching.length > 0) {
        cy.animate({
          fit: {
            eles: matching,
            padding: 120
          },
          duration: 600,
          easing: 'ease-in-out-quad'
        });
      }
    },
    highlightSearch: (query) => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.batch(() => {
        cy.elements().removeClass('highlighted-search').removeClass('dimmed-search');
        if (!query || query.trim().length < 2) {
          return;
        }
        const q = query.toLowerCase().trim();
        cy.elements().addClass('dimmed-search');
        
        cy.nodes().forEach(node => {
          const id = String(node.id()).toLowerCase();
          const label = String(node.data('displayLabel') || node.data('label') || '').toLowerCase();
          const accId = String(node.data('account_id') || '').toLowerCase();
          const role = String(node.data('node_type') || '').toLowerCase();
          
          if (id.includes(q) || label.includes(q) || accId.includes(q) || role.includes(q)) {
            node.removeClass('dimmed-search').addClass('highlighted-search');
            node.connectedEdges().removeClass('dimmed-search').addClass('highlighted-search');
          }
        });
      });
    },
    
    // Replay functions
    applyReplayState: (index, replaySteps, primaryId) => {
      const cy = cyRef.current;
      if (!cy) return;

      cy.batch(() => {
        // Hide everything first
        cy.elements().addClass('hidden-replay');

        // Always reveal the primary account node
        const pId = String(primaryId);
        const primaryNode = cy.nodes().filter(n => n.data('account_id') === pId || n.data('node_type') === 'account');
        primaryNode.removeClass('hidden-replay');

        // Show nodes and edges up to the active index
        for (let i = 0; i <= index; i++) {
          const step = replaySteps[i];
          if (!step) continue;

          const edgeId = String(step.tx_id || step.id);
          const edge = cy.getElementById(edgeId);
          if (edge.length > 0) {
            edge.removeClass('hidden-replay');
            edge.source().removeClass('hidden-replay');
            edge.target().removeClass('hidden-replay');
          }
        }

        // Update node cumulative metrics up to index
        cy.nodes().forEach(node => {
          const nodeId = node.id();
          let count = 0;
          let inflow = 0;
          let outflow = 0;

          for (let i = 0; i <= index; i++) {
            const step = replaySteps[i];
            if (!step) continue;
            
            const amt = Number(step.amount || 0);
            const fromId = String(step.source || step.from);
            const toId = String(step.target || step.to);

            if (fromId === nodeId) {
              count++;
              outflow += amt;
            }
            if (toId === nodeId) {
              count++;
              inflow += amt;
            }
          }

          if (nodeId === primaryId && index < 0) {
            node.data('tx_count', node.data('initial_tx_count') || 0);
            node.data('total_inflow', node.data('initial_total_inflow') || 0);
            node.data('total_outflow', node.data('initial_total_outflow') || 0);
          } else {
            node.data('tx_count', count);
            node.data('total_inflow', inflow);
            node.data('total_outflow', outflow);
          }
        });
      });
    },

    animateStep: (stepEdge, playbackSpeed, isNewReceiver) => {
      const cy = cyRef.current;
      if (!cy) return Promise.resolve();

      return new Promise(async (resolve) => {
        let resolved = false;
        const safeResolve = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        const safetyTimeout = setTimeout(() => {
          const edgeId = String(stepEdge.tx_id || stepEdge.id);
          const targetId = String(stepEdge.target || stepEdge.to);
          try {
            const realEdge = cy.getElementById(edgeId);
            if (realEdge.length > 0) {
              realEdge.removeClass('hidden-replay');
              realEdge.css({ opacity: 1 });
            }
            const targetNode = cy.getElementById(targetId);
            if (targetNode.length > 0) {
              targetNode.removeClass('hidden-replay');
              targetNode.css({ opacity: 1 });
            }
          } catch (e) {}
          safeResolve();
        }, (2200 / playbackSpeed) + 1000);

        const edgeId = String(stepEdge.tx_id || stepEdge.id);
        const sourceId = String(stepEdge.source || stepEdge.from);
        const targetId = String(stepEdge.target || stepEdge.to);

        const sourceNode = cy.getElementById(sourceId);
        const targetNode = cy.getElementById(targetId);
        const realEdge = cy.getElementById(edgeId);

        if (sourceNode.length === 0 || targetNode.length === 0 || realEdge.length === 0) {
          clearTimeout(safetyTimeout);
          safeResolve();
          return;
        }

        // Ensure source node is visible
        sourceNode.removeClass('hidden-replay');

        // Cinematic viewport adjustment
        const isSourceIn = isNodeInViewport(cy, sourceNode);
        const isTargetIn = isNodeInViewport(cy, targetNode);
        if (!isSourceIn || !isTargetIn) {
          const elementsToFit = cy.collection([sourceNode, targetNode]);
          cy.animate({
            fit: {
              eles: elementsToFit,
              padding: 100
            }
          }, {
            duration: 500 / playbackSpeed,
            easing: 'ease-in-out-quad',
            queue: false
          });
        }

        // 1. Highlight sender node (soft blue glow)
        sourceNode.animate({
          style: {
            'border-width': 8,
            'border-color': '#3b82f6'
          }
        }, {
          duration: 150 / playbackSpeed
        });

        await new Promise(r => setTimeout(r, 150 / playbackSpeed));

        sourceNode.animate({
          style: {
            'border-width': 2,
            'border-color': getRiskColors(sourceNode.data('risk')).border
          }
        }, {
          duration: 150 / playbackSpeed
        });

        // 2. Animate edge growth
        await animateEdgeGrowth(cy, edgeId, sourceId, targetId, 500 / playbackSpeed, playbackSpeed);

        // 3. Destination node scales and fades in (or pulses amber if already visible)
        if (isNewReceiver) {
          targetNode.removeClass('hidden-replay');
          targetNode.css({ opacity: 0, width: 50, height: 50 });
          targetNode.animate({
            style: {
              opacity: 1,
              width: 65,
              height: 65
            }
          }, {
            duration: 350 / playbackSpeed,
            easing: 'ease-out-cubic'
          });
          await new Promise(r => setTimeout(r, 350 / playbackSpeed));
        } else {
          // Soft amber pulse
          targetNode.animate({
            style: {
              'border-width': 8,
              'border-color': '#f59e0b'
            }
          }, {
            duration: 150 / playbackSpeed
          });
          await new Promise(r => setTimeout(r, 150 / playbackSpeed));
          targetNode.animate({
            style: {
              'border-width': 2,
              'border-color': getRiskColors(targetNode.data('risk')).border
            }
          }, {
            duration: 200 / playbackSpeed
          });
        }

        clearTimeout(safetyTimeout);
        safeResolve();
      });
    },
    getRenderedPosition: (nodeId) => {
      const cy = cyRef.current;
      if (!cy) return null;
      const node = cy.getElementById(nodeId);
      if (node.length > 0) {
        return node.renderedPosition();
      }
      return null;
    },
    getContainerWidth: () => {
      return containerRef.current?.clientWidth || 800;
    },
    zoomNode: (nodeId) => {
      const cy = cyRef.current;
      if (!cy) return;
      const node = cy.getElementById(nodeId);
      if (node.length > 0) {
        cy.animate({
          center: { eles: node },
          zoom: Math.min(cy.zoom() * 1.1, 1.3)
        }, {
          duration: 400,
          easing: 'ease-in-out-quad',
          queue: false
        });
      }
    },
    resetZoom: () => {
      const cy = cyRef.current;
      if (!cy) return;
      const visibleElements = cy.elements().filter(el => !el.hasClass('hidden-replay'));
      if (visibleElements.length > 0) {
        cy.animate({
          fit: {
            eles: visibleElements,
            padding: 100
          }
        }, {
          duration: 450,
          easing: 'ease-in-out-quad',
          queue: false
        });
      }
    },

    animateMoneyTrail: (accounts, amounts, totalAmount) => {
      const cy = cyRef.current;
      if (!cy) return;

      // Clear previous animations
      cy.elements().removeClass('money-trail-active money-trail-glow');

      // Fade all nodes except those in the trail
      const trailNodeIds = new Set(accounts.map(String));

      cy.nodes().forEach(node => {
        if (!trailNodeIds.has(String(node.id()))) {
          node.style('opacity', 0.15);
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
        const matchingEdges = cy.edges().filter(e =>
          String(e.source().id()) === source && String(e.target().id()) === target
        );

        if (matchingEdges.length > 0) {
          const edge = matchingEdges[0];
          edge.addClass('money-trail-active');

          // Highlight the destination node
          const targetNode = cy.getElementById(target);
          if (targetNode.length > 0) {
            targetNode.addClass('money-trail-glow');

            // After animation, reset the node
            setTimeout(() => {
              targetNode.removeClass('money-trail-glow');
            }, 600);
          }
        }

        edgeIndex++;
        setTimeout(animateNextEdge, 600);
      };

      animateNextEdge();
    },

    clearMoneyTrailAnimation: () => {
      const cy = cyRef.current;
      if (!cy) return;

      cy.elements().removeClass('money-trail-active money-trail-glow');
      cy.nodes().style('opacity', 1);
      cy.edges().style({
        'opacity': null,
        'width': null,
        'line-color': null,
        'target-arrow-color': null
      });
    },

    // Auto-trace money path from selected node
    autoTraceMoneyPath: (nodeId) => {
      const cy = cyRef.current;
      if (!cy || !nodeId) return;

      // Debug log
      console.log('[Money Trail] Starting trace from node:', nodeId);

      const startNode = cy.getElementById(String(nodeId));
      console.log('[Money Trail] Start node found:', startNode.length > 0);
      if (startNode.length === 0) return;

      // Find outgoing edges from this node
      const visited = new Set();
      const path = [String(nodeId)];
      visited.add(String(nodeId));

      let currentNode = startNode;
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops

      while (iterations < maxIterations) {
        iterations++;
        const currentId = String(currentNode.id());

        // Find outgoing edges
        const outgoing = currentNode.connectedEdges().filter(e =>
          String(e.source().id()) === currentId
        );

        console.log('[Money Trail] Outgoing edges from', currentId, ':', outgoing.length);

        if (outgoing.length === 0) break; // No more edges, stop

        // Take the first outgoing edge
        const nextEdge = outgoing[0];
        const nextNode = nextEdge.target();
        const nextId = String(nextNode.id());

        if (visited.has(nextId)) break; // Avoid cycles
        visited.add(nextId);
        path.push(nextId);

        currentNode = nextNode;
      }

      console.log('[Money Trail] Final path:', path);

      if (path.length > 1) {
        console.log('[Money Trail] Animating path with', path.length, 'nodes');

        // Glow the starting node immediately
        const startNode = cy.getElementById(String(path[0]));
        if (startNode.length > 0) {
          console.log('[Money Trail] Glowing start node:', path[0]);
          const origBg = startNode.style('background-color');
          const origBorder = startNode.style('border-color');

          startNode.style({
            'background-color': '#00ff99',
            'border-color': '#00ffcc',
            'border-width': 4,
            'width': 80,
            'height': 80
          });
        }

        // Fade all nodes except those in the trail
        const trailNodeIds = new Set(path.map(String));

        cy.nodes().forEach(node => {
          if (!trailNodeIds.has(String(node.id()))) {
            node.style('opacity', 0.15);
          } else {
            node.style('opacity', 1);
          }
        });

        // Fade all edges not in trail
        cy.edges().forEach(edge => {
          const source = String(edge.source().id());
          const target = String(edge.target().id());
          let inPath = false;

          for (let i = 0; i < path.length - 1; i++) {
            if (String(path[i]) === source && String(path[i + 1]) === target) {
              inPath = true;
              break;
            }
          }

          if (!inPath) {
            edge.style('opacity', 0.15);
          }
        });

        // Animate edges sequentially
        let edgeIndex = 0;
        const animateNextEdge = () => {
          if (edgeIndex >= path.length - 1) {
            console.log('[Money Trail] Animation complete');
            return;
          }

          const source = String(path[edgeIndex]);
          const target = String(path[edgeIndex + 1]);

          console.log('[Money Trail] Animating edge:', source, '->', target);

          // Find and highlight the edge
          const matchingEdges = cy.edges().filter(e =>
            String(e.source().id()) === source && String(e.target().id()) === target
          );

          console.log('[Money Trail] Found matching edges:', matchingEdges.length);

          if (matchingEdges.length > 0) {
            const edge = matchingEdges[0];
            edge.style({
              'line-color': '#4ecdc4',
              'target-arrow-color': '#4ecdc4',
              'width': 5,
              'opacity': 1
            });
          }

          // Highlight the destination node if it exists in graph
          const targetNode = cy.getElementById(target);
          if (targetNode.length > 0) {
            console.log('[Money Trail] Glowing destination node:', target);

            // Store original color
            const origBg = targetNode.style('background-color');
            const origBorder = targetNode.style('border-color');

            targetNode.style({
              'background-color': '#00ff99',
              'border-color': '#00ffcc',
              'border-width': 4,
              'width': 80,
              'height': 80
            });

            // After animation, reset the node
            setTimeout(() => {
              targetNode.style({
                'background-color': origBg,
                'border-color': origBorder,
                'border-width': 2,
                'width': 65,
                'height': 65
              });
            }, 600);
          } else {
            console.log('[Money Trail] Destination node not in graph:', target);
          }

          edgeIndex++;
          setTimeout(animateNextEdge, 600);
        };

        animateNextEdge();
      } else {
        console.log('[Money Trail] Path too short:', path.length);
      }
    }
  }));

  // 1. Cytoscape setup
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: graphStyles,
      layout: layoutConfig,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });

    cyRef.current = cy;
    isInitializedRef.current = true;
    
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      onNodeClickRef.current?.({ 
        id: node.id(), 
        accountId: node.data('account_id') || node.id(),
        nodeType: node.data('node_type') || 'account',
        label: node.data('label') || node.id(),
        risk: node.data('risk') || 0,
        status: node.data('status'),
        ...node.data()
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.edges().removeClass('show-label');
        onNodeClickRef.current?.(null);
      }
    });

    cy.on('mouseover tap', 'edge', (evt) => {
      cy.edges().removeClass('show-label');
      evt.target.addClass('show-label');
    });

    cy.on('mouseout', 'edge', (evt) => {
      evt.target.removeClass('show-label');
    });

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
      isInitializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const cy = cyRef.current;
    if (!container || !cy || !window.ResizeObserver) return undefined;

    const observer = new ResizeObserver(() => {
      if (cy.destroyed && cy.destroyed()) return;
      cy.resize();
      if (nodes.length > 0) {
        cy.fit(cy.elements(), getGraphBounds(container).padding);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [nodes, edges]);

  // 2. Data sync
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isInitializedRef.current) return;

    cy.batch(() => {
      const role = getRole();
      const currentIds = new Set();

      // Update or Add Nodes
      nodes.forEach((item) => {
        const nodeId = String(item.accountId || item.id || item.account_id);
        currentIds.add(nodeId);
        const displayLabel = nodeId;
        
        const nodeData = {
          ...item,
          displayLabel,
          initial_tx_count: item.tx_count,
          initial_total_inflow: item.total_inflow,
          initial_total_outflow: item.total_outflow
        };
        
        const existing = cy.getElementById(nodeId);
        if (existing.length > 0) {
          existing.data(nodeData);
        } else {
          cy.add({ data: { ...nodeData, id: nodeId } });
        }
      });

      // Update or Add Edges
      edges.forEach((edge) => {
        const edgeId = String(edge.id || edge.tx_id || `${edge.source || edge.from}-${edge.target || edge.to}`);
        currentIds.add(edgeId);
        
        const edgeData = {
          ...edge,
          source: edge.source || edge.from,
          target: edge.target || edge.to
        };
        
        const existing = cy.getElementById(edgeId);
        if (existing.length > 0) {
          existing.data({ ...edgeData, label: edgeData.label || formatTransactionLabel(edgeData) });
        } else {
          cy.add({ data: {
            ...edgeData,
            id: edgeId,
            label: edgeData.label || formatTransactionLabel(edgeData)
          } });
        }
      });

      // Remove Stale Elements
      cy.elements().forEach((ele) => {
        if (!currentIds.has(ele.id())) {
          ele.remove();
        }
      });
    });

    if (nodes.length > 0) {
      const layout = cy.layout(layoutConfig);
      if (replayMode) {
        layout.on('layoutstop', () => {
          if (cy.destroyed && cy.destroyed()) return;
          cy.batch(() => {
            cy.elements().addClass('hidden-replay');
            const primaryNode = cy.nodes().filter(n => n.data('account_id') === primaryAccountId || n.data('node_type') === 'account');
            primaryNode.removeClass('hidden-replay');
            primaryNode.forEach(node => {
              node.data('tx_count', node.data('initial_tx_count') || 0);
              node.data('total_inflow', node.data('initial_total_inflow') || 0);
              node.data('total_outflow', node.data('initial_total_outflow') || 0);
            });
          });
        });
      }
      layout.run();
    }
  }, [nodes, edges, replayMode, primaryAccountId]);

  return (
    <div
      ref={containerRef}
      className="graph-canvas"
      style={{
        width: '100%',
        height: '100%',
        background: '#090d16',
        textAlign: 'left'
      }}
    />
  );
});

export default React.memo(GraphCanvas);
