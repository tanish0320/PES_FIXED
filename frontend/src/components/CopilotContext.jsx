import React, { createContext, useContext, useState } from 'react';

// Create Context
const CopilotContext = createContext(null);

// Provider Wrapper
export function CopilotProvider({ children }) {
  const [currentInvestigation, setCurrentInvestigation] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedGraphNode, setSelectedGraphNode] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [currentReport, setCurrentReport] = useState(null);
  const [filters, setFilters] = useState({});

  const value = {
    currentInvestigation,
    setCurrentInvestigation,
    currentPage,
    setCurrentPage,
    selectedGraphNode,
    setSelectedGraphNode,
    selectedTransaction,
    setSelectedTransaction,
    currentReport,
    setCurrentReport,
    filters,
    setFilters
  };

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  );
}

// Hook to consume the state
export function useCopilot() {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
}
