import React, { createContext, useContext, useState } from 'react';

const CopilotContext = createContext(null);

export function CopilotProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      structured: true,
      data: {
        answer: "Welcome to SENTINEL AI Investigation Copilot.\n\nI can help explain investigations, analyse suspicious accounts, trace money movement and summarize reports.",
        evidence: [],
        confidence: 100,
        sources: ["Sentinel System Core"],
        suggested_actions: [],
        follow_up_questions: [
          "Explain this investigation",
          "Why is this suspicious?",
          "Summarize report",
          "Trace money flow"
        ]
      }
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currentFilters, setCurrentFilters] = useState({});
  const [conversationId, setConversationId] = useState(null);

  const value = {
    isOpen,
    setIsOpen,
    messages,
    setMessages,
    loading,
    setLoading,
    streaming,
    setStreaming,
    selectedNode,
    setSelectedNode,
    selectedTransaction,
    setSelectedTransaction,
    selectedCase,
    setSelectedCase,
    currentPage,
    setCurrentPage,
    currentFilters,
    setCurrentFilters,
    conversationId,
    setConversationId
  };

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
}
