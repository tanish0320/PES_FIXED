# Graph Enhancements for Hackathon Demo

## Overview
This package implements 4 frontend visualization enhancements to make the existing Cytoscape graph impressive for hackathon demonstration, without changing architecture or backend APIs.

## Features Implemented

### 1. Circular Money Traversal Highlight (Hero Feature)
**File**: `GraphEnhancements.js` - `CircularFlowHighlighter` class

**Functionality**:
- Detects circular flows from existing `caseDetails.patterns` data
- Fades all unrelated nodes to 20% opacity
- Highlights only the circular path edges in red
- Animates money moving through the cycle with pulse effect
- Shows detailed info panel with accounts, amount, hops, duration, confidence

**Usage**:
```javascript
const highlighter = new CircularFlowHighlighter(cy);
const flowInfo = highlighter.highlightCircularFlow(
  ['Account_A', 'Account_B', 'Account_C', 'Account_A'],
  totalAmount,
  hopCount,
  duration,
  confidence
);
```

### 2. Money Trail Animation
**File**: `GraphEnhancements.js` - `MoneyTrailAnimator` class

**Functionality**:
- Animates money flowing from origin to destination
- Illuminates edges sequentially
- Highlights destination nodes as money reaches them
- Fades unrelated nodes
- Uses existing money trail data from `caseDetails`

**Usage**:
```javascript
const animator = new MoneyTrailAnimator(cy);
animator.animateMoneyTrail(
  ['Account_1', 'Account_2', 'Account_3'],
  [amount1, amount2, amount3],
  totalAmount
);
```

### 3. Search & Focus
**File**: `GraphEnhancements.js` - `GraphSearcher` class

**Functionality**:
- Searches by: Account Number, Account Name, UPI ID, Merchant
- Zooms to matching node
- Centers graph on result
- Highlights node with golden border
- Shows immediate neighbors
- Highlights connecting edges

**Usage**:
```javascript
const searcher = new GraphSearcher(cy);
const matchData = searcher.search('UPI123456');
searcher.clearSearch();
```

### 4. Better Graph Styling
**File**: `GraphEnhancements.js` - `GraphStyler` class

**Functionality**:
- Node size scales by transaction volume
- Node colors by risk score or type:
  - Green: Low risk (<30)
  - Yellow: Medium-low (30-50)
  - Orange: Medium-high (50-70)
  - Red: High risk (≥70)
  - Blue: Banks
  - Purple: Merchants
  - Teal: UPI
  - Gray: Normal accounts
- Edge thickness scales by transaction amount
- Edge colors by amount intensity
- Edge labels show on hover (₹amount)

**Usage**:
```javascript
const styler = new GraphStyler(cy);
styler.applyEnhancedStyling({
  'node_id': { volume: 1000000, riskScore: 75, type: 'account' },
  'node_id_2': { volume: 500000, riskScore: 30, type: 'merchant' }
});
styler.enableEdgeLabelsOnHover();
```

### 5. Control Panel UI
**File**: `GraphControlPanel.jsx`

**Features**:
- Search input box with clear button
- Button for "Highlight Circular Flow"
- Button for "Trace Money" (enabled only when node selected)
- Clear Highlights button
- Info panel showing circular flow details
- Clean, dark-themed design matching existing UI

**Integration**:
```javascript
<GraphControlPanel
  onSearch={handleSearch}
  onHighlightCircularFlow={handleCircularFlow}
  onTraceMoneyTrail={handleTraceTrail}
  onClearHighlight={handleClear}
  hasCircularFlows={cyclicFlowsExist}
  selectedNode={selectedNode}
  circularFlowInfo={flowInfo}
/>
```

## Integration Steps

### 1. Import in GraphModule.jsx
```javascript
import { 
  CircularFlowHighlighter, 
  MoneyTrailAnimator, 
  GraphSearcher, 
  GraphStyler 
} from './GraphEnhancements';
import GraphControlPanel from './GraphControlPanel';
```

### 2. Initialize in GraphCanvas
```javascript
useEffect(() => {
  if (cyRef.current) {
    highlighter = new CircularFlowHighlighter(cyRef.current);
    animator = new MoneyTrailAnimator(cyRef.current);
    searcher = new GraphSearcher(cyRef.current);
    styler = new GraphStyler(cyRef.current);
    styler.applyEnhancedStyling(nodeMetadata);
    styler.enableEdgeLabelsOnHover();
  }
}, [cyRef]);
```

### 3. Expose Methods via useImperativeHandle
```javascript
useImperativeHandle(ref, () => ({
  highlightCircularFlow: (accounts, amount, hops, duration, confidence) => {
    return highlighter.highlightCircularFlow(accounts, amount, hops, duration, confidence);
  },
  traceMoneyTrail: (accounts, amounts, total) => {
    animator.animateMoneyTrail(accounts, amounts, total);
  },
  searchAccount: (query) => {
    return searcher.search(query);
  },
  clearHighlights: () => {
    highlighter.clearHighlight();
    animator.clearAnimation();
    searcher.clearSearch();
  }
}));
```

### 4. Wire Control Panel
```javascript
<GraphControlPanel
  onSearch={handleSearch}
  onHighlightCircularFlow={() => {
    const cycle = caseDetails.cycles?.[0];
    if (cycle) {
      const info = canvasRef.current.highlightCircularFlow(
        cycle.accounts,
        cycle.total_amount,
        cycle.steps,
        cycle.duration_days,
        cycle.risk_score
      );
      setCircularFlowInfo(info);
    }
  }}
  onTraceMoneyTrail={() => {
    if (selectedNode?.money_trail) {
      canvasRef.current.traceMoneyTrail(
        selectedNode.money_trail.accounts,
        selectedNode.money_trail.amounts,
        selectedNode.money_trail.total
      );
    }
  }}
  onClearHighlight={() => canvasRef.current.clearHighlights()}
  hasCircularFlows={(caseDetails?.cycles || []).length > 0}
  selectedNode={selectedNode}
  circularFlowInfo={circularFlowInfo}
/>
```

## Data Requirements

### From caseDetails.patterns (Circular Flows)
```javascript
{
  accounts: ['Account_A', 'Account_B', 'Account_C', 'Account_A'],
  total_amount: 5200000,
  steps: 3,
  duration_days: 6,
  risk_score: 96
}
```

### From selectedNode (Money Trails)
```javascript
{
  money_trail: {
    accounts: ['Origin', 'Intermediate', 'Destination'],
    amounts: [100000, 95000, 90000],
    total: 100000
  }
}
```

## Performance Notes

- All animations use requestAnimationFrame and clearTimeout for cleanup
- Cytoscape animations are hardware-accelerated
- No graph re-rendering during highlights
- Linear O(n) complexity for styling updates
- Smooth performance for 100-300 nodes

## Browser Compatibility

- Works with any Cytoscape-compatible browser
- Uses CSS transitions and requestAnimationFrame
- No canvas manipulation (keeps Cytoscape's WebGL)
- Fully compatible with existing GraphModule architecture

## Testing Checklist

- [ ] Click "Highlight Circular Flow" → sees faded nodes, red cycle path, pulsing animation
- [ ] Info panel shows correct cycle details
- [ ] Click account, click "Trace Money" → sees sequential edge illumination
- [ ] Search box finds accounts by any field → zooms and highlights
- [ ] Clear button removes all highlights
- [ ] Hover edge → shows amount label
- [ ] Node size correlates with volume
- [ ] Node colors match risk/type
- [ ] Edge colors match amount
- [ ] No performance degradation on 200+ node graphs

## Future Enhancements (NOT In This PR)

- Keyboard shortcuts (Ctrl+F for search, ESC to clear)
- Animated legend
- Transaction timeline slider
- Community clustering toggle (would require layout changes)
- Export visualization as image
