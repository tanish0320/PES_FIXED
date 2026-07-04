export const filterTools = {
  filterUPI: (context) => {
    if (context.toolHandlers.setFeedFilters) {
      context.toolHandlers.setFeedFilters({ channel: 'UPI' });
      return "Applied filter: Showing only UPI transactions.";
    }
    return "Filters are unavailable (Feed page not active). Go to the Transactions page.";
  },

  filterFailed: (context) => {
    if (context.toolHandlers.setFeedFilters) {
      context.toolHandlers.setFeedFilters({ query: 'FAILED' });
      return "Applied filter: Showing failed transactions.";
    }
    return "Filters are unavailable.";
  },

  filterCredits: (context) => {
    if (context.toolHandlers.setFeedFilters) {
      context.toolHandlers.setFeedFilters({ query: 'CREDIT' });
      return "Applied filter: Showing only Credit transactions.";
    }
    return "Filters are unavailable.";
  },

  filterDebits: (context) => {
    if (context.toolHandlers.setFeedFilters) {
      context.toolHandlers.setFeedFilters({ query: 'DEBIT' });
      return "Applied filter: Showing only Debit transactions.";
    }
    return "Filters are unavailable.";
  },

  filterHighRisk: (context) => {
    if (context.toolHandlers.setFeedFilters) {
      context.toolHandlers.setFeedFilters({ risk: 'HIGH' });
      return "Applied filter: Showing only high-risk transactions (Risk Score >= 60).";
    }
    return "Filters are unavailable.";
  },

  filterAmountThreshold: (context, thresholdAmount) => {
    if (context.toolHandlers.setFeedFilters) {
      context.toolHandlers.setFeedFilters({ query: `>${thresholdAmount}` });
      return `Applied filter: Showing transactions greater than ₹${new Intl.NumberFormat('en-IN').format(thresholdAmount)}.`;
    }
    return "Filters are unavailable.";
  },

  filterSuspiciousEntities: (context) => {
    if (context.toolHandlers.setFeedFilters) {
      context.toolHandlers.setFeedFilters({ risk: 'HIGH', query: 'SUSPICIOUS' });
      return "Applied filter: Showing transactions linked to flagged entities.";
    }
    return "Filters are unavailable.";
  },

  clearFilters: (context) => {
    if (context.toolHandlers.setFeedFilters) {
      context.toolHandlers.setFeedFilters({ caseId: 'all', channel: 'all', risk: 'all', query: '' });
      return "Cleared all active filters.";
    }
    return "Filters are unavailable.";
  }
};
