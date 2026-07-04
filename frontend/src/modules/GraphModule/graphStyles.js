export const getRiskColors = (risk) => {
  const r = Number(risk || 0);
  if (r >= 70) return { bg: '#ef4444', border: '#b91c1c' }; // Red / High
  if (r >= 40) return { bg: '#f59e0b', border: '#d97706' }; // Amber / Medium
  if (r > 0) return { bg: '#10b981', border: '#047857' };   // Green / Low
  return { bg: '#64748b', border: '#475569' };             // Gray / Unknown / External
};

export const graphStyles = [
  {
    selector: 'node',
    style: {
      'label': 'data(displayLabel)',
      'shape': 'ellipse', // default shape for account / fallback
      'background-color': '#64748b', // default bg
      'border-width': 2,
      'border-color': '#475569', // default border
      'color': '#fff',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': 10,
      'font-weight': 'bold',
      'width': 65,
      'height': 65,
      'text-outline-width': 2,
      'text-outline-color': '#0f172a',
      'text-outline-opacity': 1,
      'transition-property': 'background-color, border-color, border-width, width, height',
      'transition-duration': '0.3s'
    }
  },
  // Shapes by node type using standard selectors
  {
    selector: 'node[node_type = "person"]',
    style: {
      'shape': 'diamond'
    }
  },
  {
    selector: 'node[node_type = "upi_id"]',
    style: {
      'shape': 'hexagon'
    }
  },
  {
    selector: 'node[node_type = "merchant"]',
    style: {
      'shape': 'rectangle'
    }
  },
  {
    selector: 'node[node_type = "bank"]',
    style: {
      'shape': 'rectangle'
    }
  },
  {
    selector: 'node[node_type = "ifsc"]',
    style: {
      'shape': 'triangle'
    }
  },
  // Colors by risk using standard selectors
  {
    selector: 'node[risk >= 70]',
    style: {
      'background-color': '#ef4444',
      'border-color': '#b91c1c'
    }
  },
  {
    selector: 'node[risk >= 40][risk < 70]',
    style: {
      'background-color': '#f59e0b',
      'border-color': '#d97706'
    }
  },
  {
    selector: 'node[risk > 0][risk < 40]',
    style: {
      'background-color': '#10b981',
      'border-color': '#047857'
    }
  },
  {
    selector: 'edge',
    style: {
      'label': '',
      'width': (edge) => {
        const amt = Number(edge.data('amount') || 0);
        return Math.min(8, 2.5 + Math.log10(Math.max(1, amt / 1000)));
      },
      'line-color': '#475569',
      'target-arrow-color': '#475569',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'font-size': 9,
      'font-weight': 'bold',
      'text-rotation': 'autorotate',
      'text-margin-y': -14,
      'text-background-color': '#0f172a',
      'text-background-opacity': 0.95,
      'text-background-padding': 3,
      'text-border-color': '#1e293b',
      'text-border-width': 1,
      'text-border-opacity': 0.8,
      'opacity': 0.6,
      'arrow-scale': 0.9,
      'transition-property': 'line-color, target-arrow-color, opacity, width',
      'transition-duration': '0.2s'
    }
  },
  {
    selector: 'node.highlighted',
    style: {
      'border-width': 5,
      'border-color': '#3b82f6',
      'width': 75,
      'height': 75,
      'z-index': 100
    }
  },
  {
    selector: 'edge.highlighted',
    style: {
      'line-color': '#3b82f6',
      'target-arrow-color': '#3b82f6',
      'width': 5,
      'opacity': 1,
      'z-index': 90
    }
  },
  {
    selector: 'node.suspicious-flag',
    style: {
      'border-width': 6,
      'border-color': '#ef4444',
      'width': 75,
      'height': 75
    }
  },
  {
    selector: 'edge.suspicious-flag',
    style: {
      'line-color': '#ef4444',
      'target-arrow-color': '#ef4444',
      'width': 5,
      'opacity': 1
    }
  },
  {
    selector: 'edge.show-label',
    style: {
      'label': 'data(label)',
      'opacity': 1,
      'z-index': 110
    }
  },
  {
    selector: 'node.hidden-replay',
    style: {
      'opacity': 0,
      'events': 'no'
    }
  },
  {
    selector: 'edge.hidden-replay',
    style: {
      'opacity': 0,
      'events': 'no'
    }
  },
  {
    selector: 'node.dimmed, edge.dimmed',
    style: {
      'opacity': 0.15,
      'events': 'no'
    }
  },
  {
    selector: '.highlighted-trail',
    style: {
      'line-color': '#a855f7',
      'target-arrow-color': '#a855f7',
      'border-color': '#a855f7',
      'border-width': 5,
      'opacity': 1,
      'z-index': 200
    }
  },
  {
    selector: 'node.dimmed-search, edge.dimmed-search',
    style: {
      'opacity': 0.15,
      'events': 'no'
    }
  },
  {
    selector: '.highlighted-search',
    style: {
      'line-color': '#e11d48',
      'target-arrow-color': '#e11d48',
      'border-color': '#e11d48',
      'border-width': 5,
      'opacity': 1,
      'z-index': 200
    }
  },
  {
    selector: 'edge.money-trail-active',
    style: {
      'line-color': '#4ecdc4',
      'target-arrow-color': '#4ecdc4',
      'width': 5,
      'opacity': 1,
      'z-index': 999
    }
  },
  {
    selector: 'node.money-trail-glow',
    style: {
      'background-color': '#00ff99',
      'border-color': '#00ffcc',
      'border-width': 4,
      'width': 80,
      'height': 80,
      'opacity': 1,
      'z-index': 999
    }
  }
];
