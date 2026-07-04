import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useDataStore } from './hooks/useDataStore';

// Pages
import Feed from './pages/Feed';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import Graph from './pages/Graph';
import Upload from './pages/Upload';
import Report from './pages/Report';
import CrossCaseIntelligence from './pages/CrossCaseIntelligence';

import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import CopilotPopup from './components/CopilotPopup';
import { CopilotProvider, useCopilot } from './components/CopilotContext';
import { getRole } from './roleStore';
import { 
  UploadCloud, LayoutDashboard, FileText, Search, 
  ShieldAlert, LogOut, GitBranch, ArrowRight, User
} from 'lucide-react';

const NavigationSidebar = ({ handleLogout, role }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchEntities, cases } = useDataStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Handle typing search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        let results = await searchEntities(searchQuery);
        const match = location.pathname.match(/^\/graph\/([^/]+)/);
        if (match) {
          const currentCaseId = match[1];
          results = results.filter(res => res.case_id === currentCaseId);
        }
        setSearchResults(results);
        setShowSearchDropdown(true);
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, location.pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchResultClick = (caseId) => {
    setSearchQuery('');
    setShowSearchDropdown(false);
    navigate(`/graph/${caseId}`);
  };

  const getActiveCls = (path) => {
    return location.pathname === path 
      ? 'bg-indigo-600 text-white shadow-md' 
      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200';
  };

  const graphMatch = location.pathname.match(/^\/graph\/([^/]+)/);
  const activeCaseId = graphMatch ? graphMatch[1] : null;

  return (
    <aside className="w-72 border-r border-slate-900 bg-slate-950 flex flex-col shrink-0">
      
      {/* Branding Header */}
      <div className="p-6 border-b border-slate-900 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black italic text-white text-lg tracking-tighter">
            S
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white leading-none">SENTINEL</h2>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1 block">
              FIU Workstation
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-lg">
          <span className="text-[9px] font-black uppercase text-indigo-400">Analyst Mode</span>
          <span className="text-[9px] font-mono font-bold text-slate-400">{role.toUpperCase()}</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="p-4 border-b border-slate-900 relative" ref={dropdownRef}>
        <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block mb-1.5 pl-1">
          {activeCaseId ? `Forensic Search (${activeCaseId})` : "Forensic Global Search"}
        </span>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
          <input
            type="text"
            placeholder={activeCaseId ? "Search in this case..." : "Search name, UPI, IFSC..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
            className="w-full bg-slate-900 border border-slate-850 rounded-lg pl-9 pr-4 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-slate-700 transition-colors placeholder-slate-600"
          />
        </div>

        {/* Real-time search dropdown overlay */}
        {showSearchDropdown && (
          <div className="absolute left-4 right-4 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-850">
            {searchResults.length > 0 ? (
              searchResults.map((res, i) => (
                <div 
                  key={i} 
                  onClick={() => handleSearchResultClick(res.case_id)}
                  className="p-3 hover:bg-slate-850 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider font-mono">
                      {res.type}
                    </span>
                    <span className="text-[9px] bg-slate-950 px-1.5 py-0.5 rounded font-mono text-slate-400">
                      {res.case_id}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 truncate">{res.value}</p>
                  <p className="text-[9px] text-slate-500">{res.context}</p>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                No matching records.
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5">
        <Link 
          to="/upload" 
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${getActiveCls('/upload')}`}
        >
          <UploadCloud size={16} />
          Upload Statement
        </Link>
        <Link 
          to="/dashboard" 
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${getActiveCls('/dashboard')}`}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </Link>
        <Link 
          to="/transactions" 
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${getActiveCls('/transactions')}`}
        >
          <FileText size={16} />
          Transactions
        </Link>
        <Link 
          to="/investigations" 
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${getActiveCls('/investigations')}`}
        >
          <ShieldAlert size={16} />
          Investigations
        </Link>
        {cases.length > 1 && (
          <Link 
            to="/cross-case-intelligence" 
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${getActiveCls('/cross-case-intelligence')}`}
          >
            <GitBranch size={16} />
            Cross-Case Intelligence
          </Link>
        )}
      </nav>

      {/* Logout & Footer */}
      <div className="p-4 border-t border-slate-900 space-y-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 transition-all"
        >
          <LogOut size={12} />
          Logout Workstation
        </button>
        <div className="text-[9px] text-slate-600 uppercase font-black tracking-widest text-center">
          SENTINEL v2.0
        </div>
      </div>
    </aside>
  );
};

const AppContent = () => {
  const role = getRole();
  const location = useLocation();
  
  // AppContent is wrapped in CopilotProvider, so we can use Copilot context safely
  const copilotContext = role ? useCopilot() : null;

  useEffect(() => {
    if (!role || !copilotContext) return;
    const path = location.pathname;
    
    if (path.startsWith('/graph/')) {
      copilotContext.setCurrentPage('graph');
      const match = path.match(/^\/graph\/([^/]+)/);
      if (match) copilotContext.setCurrentInvestigation(match[1]);
    } else if (path.startsWith('/report/')) {
      copilotContext.setCurrentPage('report');
      const match = path.match(/^\/report\/([^/]+)/);
      if (match) copilotContext.setCurrentInvestigation(match[1]);
    } else if (path === '/dashboard') {
      copilotContext.setCurrentPage('dashboard');
      copilotContext.setCurrentInvestigation(null);
    } else if (path === '/transactions') {
      copilotContext.setCurrentPage('transactions');
      if (window.sentinelFilters?.caseId && window.sentinelFilters.caseId !== 'all') {
        copilotContext.setCurrentInvestigation(window.sentinelFilters.caseId);
      } else {
        copilotContext.setCurrentInvestigation(null);
      }
    } else if (path === '/investigations') {
      copilotContext.setCurrentPage('investigations');
      copilotContext.setCurrentInvestigation(null);
    } else if (path === '/upload') {
      copilotContext.setCurrentPage('upload');
      copilotContext.setCurrentInvestigation(null);
    } else if (path === '/cross-case-intelligence') {
      copilotContext.setCurrentPage('cross-case-intelligence');
    }
  }, [location.pathname, role]);

  if (!role) {
    return <Login />;
  }

  const handleLogout = () => {
    localStorage.removeItem("sentinel_role");
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 relative">
      <NavigationSidebar handleLogout={handleLogout} role={role} />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<ErrorBoundary><Upload /></ErrorBoundary>} />
          <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/transactions" element={<ErrorBoundary><Feed /></ErrorBoundary>} />
          <Route path="/investigations" element={<ErrorBoundary><Cases /></ErrorBoundary>} />
          <Route path="/graph/:caseId" element={<ErrorBoundary><Graph /></ErrorBoundary>} />
          <Route path="/report/:caseId" element={<ErrorBoundary><Report /></ErrorBoundary>} />
          <Route path="/cross-case-intelligence" element={<ErrorBoundary><CrossCaseIntelligence /></ErrorBoundary>} />
        </Routes>
      </main>

      {/* AI Investigation Copilot Persistent Popup */}
      <CopilotPopup />
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <CopilotProvider>
        <AppContent />
      </CopilotProvider>
    </Router>
  );
};

export default App;
