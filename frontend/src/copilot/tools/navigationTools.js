export const navigationTools = {
  goToDashboard: (context) => {
    if (context.toolHandlers.navigate) {
      context.toolHandlers.navigate('/dashboard');
      return "Navigated to Dashboard.";
    }
    return "Navigation handler unavailable.";
  },

  goToGraph: (context, caseId) => {
    const targetCase = caseId || context.selectedCase;
    if (context.toolHandlers.navigate && targetCase) {
      context.toolHandlers.navigate(`/graph/${targetCase}`);
      return `Navigated to Graph view for Case ${targetCase}.`;
    }
    return "Graph page unreachable (no loaded case).";
  },

  goToReport: (context, caseId) => {
    const targetCase = caseId || context.selectedCase;
    if (context.toolHandlers.navigate && targetCase) {
      context.toolHandlers.navigate(`/report/${targetCase}`);
      return `Navigated to Investigation Report for Case ${targetCase}.`;
    }
    return "Report page unreachable (no loaded case).";
  },

  goToTimeline: (context, caseId) => {
    const targetCase = caseId || context.selectedCase;
    if (context.toolHandlers.navigate && targetCase) {
      context.toolHandlers.navigate(`/report/${targetCase}`);
      return `Navigated to Timeline section inside Report for Case ${targetCase}.`;
    }
    return "Timeline unreachable (no loaded case).";
  },

  goToTransactions: (context) => {
    if (context.toolHandlers.navigate) {
      context.toolHandlers.navigate('/transactions');
      return "Navigated to Transaction Feed.";
    }
    return "Navigation handler unavailable.";
  },

  goToInvestigations: (context) => {
    if (context.toolHandlers.navigate) {
      context.toolHandlers.navigate('/investigations');
      return "Navigated to Cases list.";
    }
    return "Navigation handler unavailable.";
  },

  goToUpload: (context) => {
    if (context.toolHandlers.navigate) {
      context.toolHandlers.navigate('/upload');
      return "Navigated to Statement Upload panel.";
    }
    return "Navigation handler unavailable.";
  }
};
