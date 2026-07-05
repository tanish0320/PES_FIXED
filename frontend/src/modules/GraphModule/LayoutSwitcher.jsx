import React, { useState } from 'react';
import { Grid3x3, Circle, Layers, Zap } from 'lucide-react';

/**
 * Layout Switcher Component
 * Allows users to choose between 4 different graph layouts for large graphs (75+ nodes)
 */
export default function LayoutSwitcher({ nodeCount, onLayoutChange }) {
  const [activeLayout, setActiveLayout] = useState('hierarchical');
  const [isOpen, setIsOpen] = useState(nodeCount >= 75);

  // Only show if graph has 75+ nodes
  if (nodeCount < 75) return null;

  const layouts = [
    {
      id: 'hierarchical',
      name: 'Hierarchical',
      icon: Grid3x3,
      description: 'Top-to-bottom flow',
      cyLayout: 'breadthfirst'
    },
    {
      id: 'circular',
      name: 'Circular',
      icon: Circle,
      description: 'Ring arrangement',
      cyLayout: 'circle'
    },
    {
      id: 'clustered',
      name: 'Clustered',
      icon: Layers,
      description: 'Community groups',
      cyLayout: 'cose'
    },
    {
      id: 'radial',
      name: 'Radial',
      icon: Zap,
      description: 'Hub-spoke',
      cyLayout: 'concentric'
    }
  ];

  const handleLayoutChange = (layoutId) => {
    setActiveLayout(layoutId);
    const layout = layouts.find(l => l.id === layoutId);
    onLayoutChange(layout.cyLayout);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-5 left-5 z-50 bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-xl max-w-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-100">Graph Layout ({nodeCount} nodes)</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-500 hover:text-slate-300 text-xs"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {layouts.map((layout) => {
          const IconComponent = layout.icon;
          const isActive = activeLayout === layout.id;

          return (
            <button
              key={layout.id}
              onClick={() => handleLayoutChange(layout.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-900 border-2 border-blue-500 text-blue-100'
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <IconComponent size={18} />
              <span className="text-xs font-medium">{layout.name}</span>
              <span className="text-[10px] text-slate-400">{layout.description}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        💡 For large graphs, try different layouts to find connections more easily.
      </p>
    </div>
  );
}
