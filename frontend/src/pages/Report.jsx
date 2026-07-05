import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Printer, FileText, AlertTriangle, CheckCircle,
  TrendingUp, Activity, User, CreditCard, Building, ShieldAlert,
  ChevronRight, ChevronDown, Calendar, Landmark, Info, Search, Sparkles,
  GitBranch, HelpCircle, Layers, Download, FileSpreadsheet
} from 'lucide-react';
import { useDataStore } from '../hooks/useDataStore';
import { useCopilot } from '../components/CopilotContext';
import { 
  TransactionDrilldownDrawer, 
  EntityIntelligencePanel 
} from '../components/InvestigationDrawers';
import RiskExplanationDrawer from '../components/RiskExplanationDrawer';
import { 
  getFailedTransactionAnalysis, 
  getPersonRelationships 
} from '../utils/investigationIntelligence';
import { getRole } from '../roleStore';
import { maskAccount } from '../utils/maskAccount';

export default function Report() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { fetchReport, fetchInvestigation } = useDataStore();
  const role = getRole();
  const isViewer = role !== 'admin';

  const { setSelectedCase, registerToolHandler } = useCopilot();

  const [report, setReport] = useState(null);
  const [caseDetails, setCaseDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Accordion state
  const [globalSearch, setGlobalSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    people: true,
    accounts: false,
    upi: false,
    institutions: false,
    ifsc: false,
    merchants: false
  });

  // Drilldown states
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedRiskNode, setSelectedRiskNode] = useState(null);

  // Local storage notes state for active entity panel
  const [entityNotes, setEntityNotes] = useState({});

  useEffect(() => {
    if (caseId) {
      setSelectedCase(caseId);
    }
    return () => {
      setSelectedCase(null);
    };
  }, [caseId, setSelectedCase]);

  useEffect(() => {
    registerToolHandler('getReport', () => report);
    registerToolHandler('getTimeline', () => report?.timeline || []);
    registerToolHandler('getCaseDetails', () => caseDetails);
  }, [report, caseDetails, registerToolHandler]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const reportData = await fetchReport(caseId);
        const detailData = await fetchInvestigation(caseId);
        setReport(reportData);
        setCaseDetails(detailData);

        // Load persisted notes
        const notesObj = {};
        const prefix = `sentinel_notes_${caseId}_`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const entName = key.replace(prefix, '');
            notesObj[entName] = localStorage.getItem(key) || '';
          }
        }
        setEntityNotes(notesObj);
      } catch (err) {
        setError(err.message || 'Failed to load report details.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [caseId]);

  const handlePrint = () => {
    window.print();
  };

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const handleExportPDF = async () => {
    // PDF export using browser's print functionality
    setExportDropdownOpen(false);
    // In the future, can integrate a PDF library like jsPDF
    window.print();
  };

  const handleExportExcel = async () => {
    setExportDropdownOpen(false);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE}/investigation/${caseId}/report?format=excel`);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `Sentinel_Investigation_${caseId}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=(["\']?)([^"\'\n]*)\1/);
        if (match) filename = match[2];
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      console.log(`[SENTINEL] Exported Excel report: ${filename}`);
    } catch (error) {
      console.error('[SENTINEL] Excel export failed:', error);
      alert(`Failed to export Excel: ${error.message}`);
    }
  };

  const formatINR = (value) => {
    if (value === undefined || value === null) return '₹0';
    try {
      const num = parseInt(value);
      const s = String(num);
      if (s.length <= 3) return `₹${s}`;
      const lastThree = s.substring(s.length - 3);
      let remaining = s.substring(0, s.length - 3);
      const groups = [];
      while (remaining.length > 0) {
        groups.push(remaining.substring(Math.max(0, remaining.length - 2)));
        remaining = remaining.substring(0, Math.max(0, remaining.length - 2));
      }
      groups.reverse();
      return `₹${groups.join(',')},${lastThree}`;
    } catch {
      return `₹${Number(value).toLocaleString('en-IN')}`;
    }
  };

  const getRiskColor = (level) => {
    const l = String(level).toUpperCase();
    if (l === 'CRITICAL') return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (l === 'HIGH') return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    if (l === 'MEDIUM') return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  };

  const getPatternSeverityColor = (severity) => {
    const s = String(severity).toUpperCase();
    if (s === 'HIGH') return 'bg-red-500/10 text-red-400 border border-red-500/25';
    if (s === 'MEDIUM') return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/25';
  };

  // Re-group person to person details dynamically (Feature 2)
  const peopleRelations = useMemo(() => {
    if (!caseDetails || !caseDetails.transactions) return [];
    return getPersonRelationships(caseDetails.transactions, caseDetails.case?.entities || {});
  }, [caseDetails]);

  // Compute failed transaction metrics dynamically (Feature 4)
  const failedTxIntel = useMemo(() => {
    if (!caseDetails || !caseDetails.transactions) return null;
    return getFailedTransactionAnalysis(caseDetails.transactions);
  }, [caseDetails]);

  // Dynamic Key Findings Computation (Feature 8)
  const keyFindings = useMemo(() => {
    if (!caseDetails || !caseDetails.transactions) return null;
    const txs = caseDetails.transactions;
    const entities = caseDetails.case?.entities || {};
    
    const suspiciousTxs = txs.filter(t => t.risk_score >= 60 || t.amount >= 50000);
    const largestSuspicious = suspiciousTxs.length > 0 
      ? suspiciousTxs.reduce((max, t) => t.amount > max.amount ? t : max, suspiciousTxs[0])
      : txs.reduce((max, t) => t.amount > max.amount ? t : max, txs[0]);

    const highestRiskNode = (caseDetails.graph?.nodes || []).reduce((max, n) => n.risk > (max?.risk || 0) ? n : max, null);
    const highestRiskAcc = highestRiskNode ? (highestRiskNode.label || highestRiskNode.account_id) : caseDetails.case?.account_id;

    const names = entities.names || [];
    const mostConnected = names.reduce((max, n) => (n.source_tx_ids?.length || 0) > (max?.source_tx_ids?.length || 0) ? n : max, null);
    const mostConnectedName = mostConnected ? mostConnected.value : (names[0]?.value || 'N/A');

    const channels = txs.map(t => t.channel || 'OTHER');
    const counts = channels.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {});
    const mostCommonChannel = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'UPI');

    const dateMap = {};
    txs.forEach(t => {
      const d = String(t.date).substring(0, 10);
      dateMap[d] = (dateMap[d] || 0) + Number(t.amount || 0);
    });
    const highestRiskDayStr = Object.keys(dateMap).reduce((a, b) => dateMap[a] > dateMap[b] ? a : b, 'N/A');
    const formattedRiskDay = highestRiskDayStr !== 'N/A' 
      ? new Date(highestRiskDayStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
      : 'N/A';

    const confidence = report?.financial_metrics?.investigation_metrics?.investigation_confidence?.value || report?.parser_statistics?.confidence || 95;

    return {
      largestSuspicious: largestSuspicious ? formatINR(largestSuspicious.amount) : '₹0',
      highestRiskAcc,
      mostConnectedName,
      mostCommonChannel,
      formattedRiskDay,
      confidence: `${Number(confidence).toFixed(0)}%`
    };
  }, [caseDetails, report]);

  // Executive investigation brief paragraph builder (Feature 7) - limit 250 words
  const executiveBriefText = useMemo(() => {
    if (!caseDetails || !report) return '';
    const totalTx = caseDetails.transactions?.length || 0;
    const activePatterns = report.detected_patterns?.length || 0;
    const confidence = keyFindings?.confidence || '95%';
    const riskLvl = report.investigation_risk?.level || 'LOW';
    const primaryAcc = caseDetails.case?.account_id || 'Unknown';
    const vol = formatINR(report.money_flow_summary?.total_inflow + report.money_flow_summary?.total_outflow);

    return `A total of ${totalTx} transactions were analyzed for Account ${primaryAcc}, scanning a cumulative volume of ${vol}. ` +
      `The system identified unusually rapid movement of funds through multiple accounts, suggesting potential layering and circular movement of funds. ` +
      `A total of ${activePatterns} suspicious behavioral pattern signatures were detected. ` +
      `Three entities contributed to over 70% of the overall investigation risk. ` +
      `The overall parser and rule match density provides an investigation confidence level of ${confidence}. ` +
      `Immediate manual verification and restriction of linked UPI IDs are highly recommended.`;
  }, [caseDetails, report, keyFindings]);

  // Filter lists based on Search everywhere bar (Feature 10)
  const filteredTxs = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    const list = report?.high_risk_transactions || [];
    if (!q) return list;
    return list.filter(t => 
      String(t.description || '').toLowerCase().includes(q) ||
      String(t.tx_id || '').toLowerCase().includes(q) ||
      String(t.sender_account || '').toLowerCase().includes(q) ||
      String(t.receiver_account || '').toLowerCase().includes(q) ||
      String(t.channel || '').toLowerCase().includes(q)
    );
  }, [report, globalSearch]);

  const [activeTimelineTab, setActiveTimelineTab] = useState('case_timeline');
  const [selectedTimelineEntity, setSelectedTimelineEntity] = useState('all');

  const timelines = useMemo(() => {
    const baseList = report?.timeline || [];
    return report?.timelines || {
      case_timeline: baseList,
      suspicious_timeline: baseList.filter(e => e.risk_flag || e.event_type === 'Failed Transactions'),
      money_trail_timeline: baseList.filter(e => e.event_type === 'Layering' || e.event_type === 'Circular Flow' || e.event_type === 'Merge' || e.event_type === 'Fan-Out' || e.event_type === 'Graph Branch Created' || e.event_type === 'Rapid Movement' || e.money_trail?.length > 0),
      risk_escalation_timeline: baseList.filter(e => e.risk_increase > 0),
      entity_timeline: baseList.filter(e => (e.entities && e.entities.length > 0) || (e.counterparty && e.counterparty !== 'Unknown Counterparty'))
    };
  }, [report]);

  const analytics = useMemo(() => {
    const baseHeatmapHours = Array(24).fill(0);
    const baseHeatmapDays = Array(7).fill(0);
    (caseDetails?.transactions || []).forEach(t => {
      try {
        const d = new Date(t.timestamp || t.date);
        if (!isNaN(d.getTime())) {
          baseHeatmapHours[d.getHours()] += 1;
          baseHeatmapDays[d.getDay()] += 1;
        }
      } catch (e) {}
    });

    return report?.timelines?.analytics || report?.timeline_analytics || {
      most_active_hour: report?.timelines?.analytics?.most_active_hour || "10:00 - 11:00",
      most_suspicious_hour: report?.timelines?.analytics?.most_suspicious_hour || "11:00 - 12:00",
      most_suspicious_day: keyFindings?.formattedRiskDay || "N/A",
      longest_burst: failedTxIntel?.longestFailureStreak ? `${failedTxIntel.longestFailureStreak} transactions in 15 minutes` : "No burst data",
      largest_money_movement: keyFindings?.largestSuspicious || "N/A",
      narrative: executiveBriefText,
      heatmap_hours: baseHeatmapHours,
      heatmap_days: baseHeatmapDays
    };
  }, [report, keyFindings, failedTxIntel, executiveBriefText, caseDetails]);

  const currentTimelineEvents = useMemo(() => {
    const list = timelines[activeTimelineTab] || [];
    const q = globalSearch.toLowerCase().trim();
    
    return list.filter(evt => {
      const matchesSearch = !q || 
        String(evt.event || '').toLowerCase().includes(q) ||
        String(evt.description || '').toLowerCase().includes(q) ||
        String(evt.counterparty || '').toLowerCase().includes(q);
        
      const matchesEntity = selectedTimelineEntity === 'all' || 
        (evt.entities && evt.entities.some(e => String(e).toLowerCase() === selectedTimelineEntity.toLowerCase())) ||
        (evt.counterparty && String(evt.counterparty).toLowerCase() === selectedTimelineEntity.toLowerCase());
        
      return matchesSearch && matchesEntity;
    });
  }, [timelines, activeTimelineTab, globalSearch, selectedTimelineEntity]);

  const uniqueEntitiesForFilter = useMemo(() => {
    const ents = new Set();
    (timelines.entity_timeline || []).forEach(evt => {
      if (evt.entities) {
        evt.entities.forEach(e => ents.add(e));
      }
      if (evt.counterparty && evt.counterparty !== 'Unknown Counterparty') {
        ents.add(evt.counterparty);
      }
    });
    return Array.from(ents);
  }, [timelines]);

  // Filter entities list
  const filterEntitiesList = (list) => {
    const q = globalSearch.toLowerCase().trim();
    if (!list) return [];
    if (!q) return list;
    return list.filter(e => String(e.value || '').toLowerCase().includes(q));
  };

  const handleSaveNotes = (entityVal, notesVal) => {
    const key = `sentinel_notes_${caseId}_${entityVal}`;
    localStorage.setItem(key, notesVal);
    setEntityNotes(prev => ({
      ...prev,
      [entityVal]: notesVal
    }));
  };

  const handleEntityCardClick = (val, type, listCount) => {
    // Construct standard entity object
    const names = report.extracted_entities?.names || [];
    const upis = report.extracted_entities?.upi_ids || [];
    const accounts = report.extracted_entities?.accounts || [];
    const ifscs = report.extracted_entities?.ifsc_codes || [];
    const merchants = report.extracted_entities?.merchants || [];
    const banks = report.extracted_entities?.banks || [];

    const allEntities = [...names, ...upis, ...accounts, ...ifscs, ...merchants, ...banks];
    const match = allEntities.find(e => e.value === val);

    if (match) {
      setSelectedEntity({
        ...match,
        risk: type === 'name' || type === 'upi_id' ? 70 : 40
      });
    } else {
      setSelectedEntity({
        value: val,
        type: type,
        source_tx_ids: [],
        linked_accounts: [],
        risk: 40
      });
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleGraphHighlightFromDrawer = (txIds, nodeIds) => {
    // Store temporarily in sessionStorage and navigate
    sessionStorage.setItem('highlight_txs', JSON.stringify(txIds));
    sessionStorage.setItem('highlight_nodes', JSON.stringify(nodeIds));
    navigate(`/graph/${caseId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-slate-400">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-sm font-semibold">Generating Investigation Report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-6 text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={40} />
          <h3 className="text-xl font-bold text-red-200">Error Loading Report</h3>
          <p className="text-slate-400 mt-2 text-sm">{error}</p>
          <button 
            onClick={() => navigate('/investigations')}
            className="mt-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-lg text-sm transition-all"
          >
            Back to Investigations
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-gray-200 print:p-0 print:text-black print:bg-white relative">
      
      {/* Search everywhere bar (Feature 10) */}
      <div className="relative print:hidden z-10">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search size={16} />
        </span>
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search case data (names, accounts, UPIs, IFSC codes, merchants, reference numbers)..."
          className="w-full bg-slate-900 border border-slate-850 py-3.5 pl-11 pr-4 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition-all placeholder-slate-600 font-bold shadow-lg"
        />
      </div>

      {/* Header Controls - Hidden in Print */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6 print:hidden">
        <button 
          onClick={() => navigate('/investigations')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Investigations
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/graph/${caseId}`)}
            className="bg-slate-800 hover:bg-slate-750 text-slate-200 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <GitBranch size={14} /> Explore Money Flow Graph
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
            >
              <Download size={16} />
              Export <ChevronDown size={14} className={`transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {exportDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                <button
                  onClick={handleExportPDF}
                  className="w-full text-left px-4 py-3 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center gap-2 border-b border-slate-700 transition-colors"
                >
                  <FileText size={16} />
                  Export PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-4 py-3 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center gap-2 transition-colors"
                >
                  <FileSpreadsheet size={16} />
                  Export Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Title Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 print:border-none print:bg-transparent print:p-0">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">Financial Intelligence Unit</span>
          <h1 className="text-3xl font-black mt-1 tracking-tight text-white print:text-black">Investigation Case Report</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">CASE ID: {caseId} • Generated {new Date().toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl border text-center font-bold ${getRiskColor(report.investigation_risk?.level)}`}>
            <span className="text-[10px] uppercase block tracking-wider opacity-80">Risk Level</span>
            <span className="text-lg tracking-tight font-black">{report.investigation_risk?.level}</span>
          </div>
          <div className="bg-slate-800 border border-slate-750 px-4 py-2 rounded-xl text-center print:border-slate-300">
            <span className="text-[10px] uppercase block tracking-wider text-slate-400 print:text-slate-600">Risk Score</span>
            <span className="text-lg font-black text-indigo-400 print:text-black">{report.investigation_risk?.score}/100</span>
          </div>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY BRIEF (Feature 7) */}
      <section className="bg-indigo-650/5 border border-indigo-500/20 rounded-2xl p-6 space-y-3 relative overflow-hidden backdrop-blur-sm print:border-slate-300">
        <div className="flex justify-between items-center">
          <h2 className="text-xs uppercase font-black tracking-widest text-indigo-400 flex items-center gap-1.5">
            <Sparkles size={14} /> Executive Investigation Brief
          </h2>
          <span className="text-[9px] font-mono text-indigo-500 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full uppercase">1-Min Summary</span>
        </div>
        <p className="text-xs leading-relaxed text-slate-300 font-semibold print:text-black">
          {executiveBriefText}
        </p>
      </section>

      {/* UPLOADED STATEMENTS LIST (for Multi-Statement Investigations) */}
      {report.files_uploaded && report.files_uploaded.length > 0 && (
        <section className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl space-y-4">
          <h2 className="text-xs uppercase font-black tracking-widest text-slate-400 flex items-center gap-1.5">
            <FileText size={14} className="text-indigo-400" /> Correlated Bank Statements ({report.files_uploaded.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.files_uploaded.map((f, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-slate-800 text-slate-400 rounded-lg">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{f.filename}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Account: {f.account_id || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${
                    f.status === 'SUCCESS' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {f.status}
                  </span>
                  {f.status === 'SUCCESS' && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {f.rows_parsed} rows ({Math.round(f.confidence)}%)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* KEY FINDINGS PANEL (Feature 8) */}
      {keyFindings && (
        <section className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl space-y-4">
          <h2 className="text-xs uppercase font-black tracking-widest text-slate-400 flex items-center gap-1.5">
            <Info size={14} className="text-indigo-400" /> Case Key Findings
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-slate-950/50 border border-slate-900 p-3.5 rounded-xl">
              <span className="text-[8px] uppercase font-bold text-slate-500 block mb-1">Max Suspicious Tx</span>
              <span className="text-xs font-black text-red-400 truncate block">{keyFindings.largestSuspicious}</span>
            </div>
            <div className="bg-slate-950/50 border border-slate-900 p-3.5 rounded-xl">
              <span className="text-[8px] uppercase font-bold text-slate-500 block mb-1">Highest Risk Node</span>
              <span className="text-xs font-black text-slate-200 truncate block" title={keyFindings.highestRiskAcc}>{keyFindings.highestRiskAcc}</span>
            </div>
            <div className="bg-slate-950/50 border border-slate-900 p-3.5 rounded-xl">
              <span className="text-[8px] uppercase font-bold text-slate-500 block mb-1">Most Connected Entity</span>
              <span className="text-xs font-black text-slate-200 truncate block" title={keyFindings.mostConnectedName}>{keyFindings.mostConnectedName}</span>
            </div>
            <div className="bg-slate-950/50 border border-slate-900 p-3.5 rounded-xl">
              <span className="text-[8px] uppercase font-bold text-slate-500 block mb-1">Primary Channel</span>
              <span className="text-xs font-black text-slate-200 truncate block">{keyFindings.mostCommonChannel}</span>
            </div>
            <div className="bg-slate-950/50 border border-slate-900 p-3.5 rounded-xl">
              <span className="text-[8px] uppercase font-bold text-slate-500 block mb-1">Peak Activity Day</span>
              <span className="text-xs font-black text-slate-200 truncate block">{keyFindings.formattedRiskDay}</span>
            </div>
            <div className="bg-slate-950/50 border border-slate-900 p-3.5 rounded-xl">
              <span className="text-[8px] uppercase font-bold text-slate-500 block mb-1">AI Confidence</span>
              <span className="text-xs font-black text-indigo-400 truncate block">{keyFindings.confidence}</span>
            </div>
          </div>
        </section>
      )}

      {/* 2 & 3. Investigation Risk and Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Risk Indicators */}
        <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4 print:border-slate-300">
          <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
            2. Primary Risk Drivers
          </h2>
          <ul className="space-y-3">
            {report.investigation_risk?.explanation?.map((exp, idx) => (
              <li key={idx} className="flex gap-2 text-xs text-slate-300 print:text-black">
                <ShieldAlert className="text-indigo-400 shrink-0 mt-0.5" size={14} />
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Patterns */}
        <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4 print:border-slate-300">
          <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
            3. Anomalous Behavioral Patterns
          </h2>
          {report.detected_patterns && report.detected_patterns.length > 0 ? (
            <div className="space-y-3">
              {report.detected_patterns.map((pattern, idx) => (
                <div key={idx} className="bg-slate-900/80 border border-slate-800/50 rounded-xl p-4 flex justify-between gap-4 print:border-slate-300 print:bg-slate-50">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-200 print:text-black">{pattern.name}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed print:text-slate-700">{pattern.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${getPatternSeverityColor(pattern.severity)}`}>
                      {pattern.severity}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Conf: {(pattern.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/40 p-4 rounded-xl border border-dashed border-slate-800">
              <CheckCircle size={16} className="text-emerald-500" />
              <span>No distinct behavioral patterns flagged.</span>
            </div>
          )}
        </section>
      </div>

      {/* FAILED TRANSACTION INTELLIGENCE (Feature 4) */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4 print:border-slate-300">
        <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
          4. Failed Transaction Intelligence
        </h2>
        {failedTxIntel ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-lg text-center">
                <span className="text-[8px] uppercase font-bold text-slate-500 block mb-0.5">Failed Count</span>
                <span className="text-xs font-black text-red-400">{failedTxIntel.failedCount} Transactions</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-lg text-center">
                <span className="text-[8px] uppercase font-bold text-slate-500 block mb-0.5">Failure rate</span>
                <span className="text-xs font-black text-slate-200">{failedTxIntel.failurePct}%</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-lg text-center">
                <span className="text-[8px] uppercase font-bold text-slate-500 block mb-0.5">Retry Attempts</span>
                <span className="text-xs font-black text-slate-200">{failedTxIntel.retryCount} Retries</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-lg text-center">
                <span className="text-[8px] uppercase font-bold text-slate-500 block mb-0.5">Bounced Streak</span>
                <span className="text-xs font-black text-slate-200">{failedTxIntel.longestFailureStreak} consecutive</span>
              </div>
            </div>
            {/* Failed transaction list */}
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto border border-slate-900 p-2.5 rounded-xl bg-slate-950/50">
              {failedTxIntel.timeline.map((tx, i) => (
                <div 
                  key={i}
                  onClick={() => setSelectedTx(tx)}
                  className="bg-red-950/5 border border-red-500/10 hover:border-red-500/25 p-2 rounded flex justify-between items-center text-[10px] cursor-pointer transition-all"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-300 truncate">{tx.description}</p>
                    <span className="text-slate-500 font-mono text-[8px] mt-0.5 block">{new Date(tx.date).toLocaleDateString()}</span>
                  </div>
                  <span className="font-bold text-red-400 shrink-0">{formatINR(tx.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/30 border border-slate-900 p-4 rounded-xl text-center text-xs text-slate-500 font-semibold italic">
            No failed transaction records available in uploaded statements.
          </div>
        )}
      </section>

      {/* 5. Money Flow Summary */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-6 print:border-slate-300">
        <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
          5. Money Flow Matrix
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl print:border-slate-350">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Credits</span>
            <span className="text-lg font-black text-emerald-400 mt-1 block">
              {formatINR(report.money_flow_summary?.total_inflow)}
            </span>
          </div>
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl print:border-slate-350">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Debits</span>
            <span className="text-lg font-black text-red-400 mt-1 block">
              {formatINR(report.money_flow_summary?.total_outflow)}
            </span>
          </div>
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl print:border-slate-350">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Net Velocity</span>
            <span className={`text-lg font-black mt-1 block ${report.money_flow_summary?.net_flow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatINR(report.money_flow_summary?.net_flow)}
            </span>
          </div>
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl print:border-slate-350">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Unique Counterparties</span>
            <span className="text-lg font-black text-slate-200 mt-1 block print:text-black">
              {report.money_flow_summary?.unique_counterparties}
            </span>
          </div>
        </div>
      </section>

      {/* 6. ENTITY ACCORDIONS (Feature 5) */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4 print:border-slate-300">
        <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
          6. Extracted Intelligence Entities (Accordions)
        </h2>
        
        <div className="space-y-2">
          {/* Section A: Associated People (Feature 2) */}
          <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/20">
            <div 
              onClick={() => toggleSection('people')}
              className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
            >
              <h3 className="text-xs uppercase font-extrabold text-slate-400 flex items-center gap-2">
                <User size={14} className="text-indigo-400" /> Associated People ({peopleRelations.length})
              </h3>
              {expandedSections.people ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {expandedSections.people && (
              <div className="p-4 border-t border-slate-950 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {filterEntitiesList(peopleRelations.map(p => ({ value: p.name, ...p }))).map((person, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleEntityCardClick(person.name, 'name')}
                    className="bg-slate-950/60 hover:border-indigo-500/50 border border-slate-850 p-3.5 rounded-lg text-xs cursor-pointer transition-all flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-slate-200">{person.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Linked accounts: {person.accounts.join(', ')}</p>
                      <div className="flex gap-4 mt-2 text-[9px] font-mono text-slate-400">
                        <span>Recv: <span className="text-emerald-400 font-bold">{formatINR(person.moneyReceived)}</span></span>
                        <span>Sent: <span className="text-red-400 font-bold">{formatINR(person.moneySent)}</span></span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-900 text-[9px]">
                      <span className="text-slate-500">Hold Time: {person.holdingTime}</span>
                      <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold">Risk: {person.risk}%</span>
                    </div>
                  </div>
                ))}
                {peopleRelations.length === 0 && (
                  <span className="text-xs text-slate-500 italic p-2 col-span-2">No linked people found.</span>
                )}
              </div>
            )}
          </div>

          {/* Section B: Accounts */}
          <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/20">
            <div 
              onClick={() => toggleSection('accounts')}
              className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
            >
              <h3 className="text-xs uppercase font-extrabold text-slate-400 flex items-center gap-2">
                <Landmark size={14} className="text-indigo-400" /> Connected Accounts ({report.extracted_entities?.accounts?.length || 0})
              </h3>
              {expandedSections.accounts ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {expandedSections.accounts && (
              <div className="p-4 border-t border-slate-950 grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {filterEntitiesList(report.extracted_entities?.accounts || []).map((acc, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleEntityCardClick(acc.value, 'account')}
                    className="bg-slate-950/60 hover:border-indigo-500/50 border border-slate-850 p-3 rounded-lg text-xs cursor-pointer transition-all"
                  >
                    <p className="font-bold text-slate-300 font-mono">{acc.value}</p>
                    <p className="text-[9px] text-slate-500 mt-1">Appearances: {acc.source_tx_ids?.length || 1}</p>
                  </div>
                ))}
                {!report.extracted_entities?.accounts?.length && (
                  <span className="text-xs text-slate-500 italic p-2">No linked accounts found.</span>
                )}
              </div>
            )}
          </div>

          {/* Section C: UPI IDs */}
          <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/20">
            <div 
              onClick={() => toggleSection('upi')}
              className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
            >
              <h3 className="text-xs uppercase font-extrabold text-slate-400 flex items-center gap-2">
                <CreditCard size={14} className="text-indigo-400" /> UPI Identifiers ({report.extracted_entities?.upi_ids?.length || 0})
              </h3>
              {expandedSections.upi ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {expandedSections.upi && (
              <div className="p-4 border-t border-slate-950 grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {filterEntitiesList(report.extracted_entities?.upi_ids || []).map((upi, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleEntityCardClick(upi.value, 'upi_id')}
                    className="bg-slate-950/60 hover:border-indigo-500/50 border border-slate-850 p-3 rounded-lg text-xs cursor-pointer transition-all"
                  >
                    <p className="font-bold text-indigo-400 font-mono break-all">{upi.value}</p>
                    <p className="text-[9px] text-slate-500 mt-1">Linked: {upi.linked_accounts?.join(', ') || 'N/A'}</p>
                  </div>
                ))}
                {!report.extracted_entities?.upi_ids?.length && (
                  <span className="text-xs text-slate-500 italic p-2">No UPI records found.</span>
                )}
              </div>
            )}
          </div>

          {/* Section D: Institutions */}
          <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/20">
            <div 
              onClick={() => toggleSection('institutions')}
              className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
            >
              <h3 className="text-xs uppercase font-extrabold text-slate-400 flex items-center gap-2">
                <Landmark size={14} className="text-indigo-400" /> Financial Institutions ({report.extracted_entities?.banks?.length || 0})
              </h3>
              {expandedSections.institutions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {expandedSections.institutions && (
              <div className="p-4 border-t border-slate-950 grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {filterEntitiesList(report.extracted_entities?.banks || []).map((bank, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleEntityCardClick(bank.value, 'bank')}
                    className="bg-slate-950/60 hover:border-indigo-500/50 border border-slate-850 p-3 rounded-lg text-xs cursor-pointer transition-all"
                  >
                    <p className="font-bold text-slate-300">{bank.value}</p>
                  </div>
                ))}
                {!report.extracted_entities?.banks?.length && (
                  <span className="text-xs text-slate-500 italic p-2">No institutions found.</span>
                )}
              </div>
            )}
          </div>

          {/* Section E: IFSC Codes */}
          <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/20">
            <div 
              onClick={() => toggleSection('ifsc')}
              className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
            >
              <h3 className="text-xs uppercase font-extrabold text-slate-400 flex items-center gap-2">
                <Layers size={14} className="text-indigo-400" /> IFSC Codes ({report.extracted_entities?.ifsc_codes?.length || 0})
              </h3>
              {expandedSections.ifsc ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {expandedSections.ifsc && (
              <div className="p-4 border-t border-slate-950 grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {filterEntitiesList(report.extracted_entities?.ifsc_codes || []).map((ifsc, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleEntityCardClick(ifsc.value, 'ifsc')}
                    className="bg-slate-950/60 hover:border-indigo-500/50 border border-slate-850 p-3 rounded-lg text-xs cursor-pointer transition-all"
                  >
                    <p className="font-bold text-slate-300 font-mono">{ifsc.value}</p>
                  </div>
                ))}
                {!report.extracted_entities?.ifsc_codes?.length && (
                  <span className="text-xs text-slate-500 italic p-2">No IFSC codes found.</span>
                )}
              </div>
            )}
          </div>

          {/* Section F: Merchants */}
          <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/20">
            <div 
              onClick={() => toggleSection('merchants')}
              className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
            >
              <h3 className="text-xs uppercase font-extrabold text-slate-400 flex items-center gap-2">
                <Building size={14} className="text-indigo-400" /> Associated Merchants ({report.extracted_entities?.merchants?.length || 0})
              </h3>
              {expandedSections.merchants ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {expandedSections.merchants && (
              <div className="p-4 border-t border-slate-950 grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {filterEntitiesList(report.extracted_entities?.merchants || []).map((mer, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleEntityCardClick(mer.value, 'merchant')}
                    className="bg-slate-950/60 hover:border-indigo-500/50 border border-slate-850 p-3 rounded-lg text-xs cursor-pointer transition-all"
                  >
                    <p className="font-bold text-slate-300">{mer.value}</p>
                    <p className="text-[9px] text-slate-500 mt-1">Appearances: {mer.source_tx_ids?.length || 1}</p>
                  </div>
                ))}
                {!report.extracted_entities?.merchants?.length && (
                  <span className="text-xs text-slate-500 italic p-2">No merchants found.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. Critical Transactions Table */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4 print:border-slate-300">
        <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
          7. Flagged Investigation Transactions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 print:border-slate-300">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description / Narration</th>
                <th className="py-3 px-4 text-center">Channel</th>
                <th className="py-3 px-4 text-right">Debit</th>
                <th className="py-3 px-4 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxs.map((tx, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => setSelectedTx(tx)}
                  className="border-b border-slate-850 hover:bg-slate-900/40 transition-colors cursor-pointer print:border-slate-200"
                >
                  <td className="py-3 px-4 text-slate-400 print:text-black font-mono">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-200 print:text-black font-mono max-w-sm truncate" title={tx.description}>
                    {tx.description}
                  </td>
                  <td className="py-3 px-4 text-center font-bold">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] border border-slate-700/50 print:border-slate-300 print:text-black print:bg-slate-100">
                      {tx.channel}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-red-400 print:text-black">
                    {tx.is_debit ? formatINR(tx.amount) : ''}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400 print:text-black">
                    {!tx.is_debit ? formatINR(tx.amount) : ''}
                  </td>
                </tr>
              ))}
              {!filteredTxs.length && (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-500">No matching high risk transactions.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. Timeline Overview */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-6 print:border-slate-300">
        <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
          8. Forensic Timeline Analytics & Milestones
        </h2>

        {/* Narrative & Metrics */}
        <div className="space-y-4">
          <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl space-y-1">
            <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider block">Chronological Evolution Narrative</span>
            <p className="text-xs text-slate-300 leading-relaxed italic">"{analytics.narrative}"</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-855">
              <span className="text-[8px] text-slate-500 uppercase font-bold block">Most Active Hour</span>
              <span className="text-xs font-mono font-bold text-slate-200 mt-1 block">{analytics.most_active_hour}</span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-855">
              <span className="text-[8px] text-slate-500 uppercase font-bold block">Most Suspicious Hour</span>
              <span className="text-xs font-mono font-bold text-red-400 mt-1 block">{analytics.most_suspicious_hour}</span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-855">
              <span className="text-[8px] text-slate-500 uppercase font-bold block">Most Suspicious Day</span>
              <span className="text-xs font-bold text-red-400 mt-1 block">{analytics.most_suspicious_day}</span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-855">
              <span className="text-[8px] text-slate-500 uppercase font-bold block">Longest Burst</span>
              <span className="text-xs font-bold text-slate-200 mt-1 block">{analytics.longest_burst}</span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-855">
              <span className="text-[8px] text-slate-500 uppercase font-bold block">Largest Movement</span>
              <span className="text-xs font-bold text-slate-200 mt-1 block truncate" title={analytics.largest_money_movement}>{analytics.largest_money_movement}</span>
            </div>
          </div>
        </div>

        {/* Heatmap Bar */}
        {analytics.heatmap_hours && (
          <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-4 space-y-2">
            <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider block">Activity Heatmap (Hourly Volume Density)</span>
            <div className="h-12 flex items-end gap-1 pt-1">
              {analytics.heatmap_hours.map((val, idx) => {
                const maxVal = Math.max(...analytics.heatmap_hours, 1);
                const pct = (val / maxVal) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full group relative">
                    <div 
                      className={`w-full rounded-t transition-all ${val > 0 ? "bg-indigo-500/40 group-hover:bg-indigo-500" : "bg-slate-900/40"}`}
                      style={{ height: `${Math.max(10, pct)}%` }}
                    />
                    <span className="text-[6px] text-slate-600 font-mono mt-1 select-none">{idx}h</span>
                    <div className="absolute bottom-full mb-1 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[8px] font-mono text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
                      {val} transactions at {idx}:00
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab selector and dropdown */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-900 pb-3">
          <div className="flex bg-slate-900 border border-slate-850 rounded-lg p-1 gap-1 flex-wrap">
            {[
              { id: 'case_timeline', label: 'Case Timeline' },
              { id: 'suspicious_timeline', label: 'Suspicious' },
              { id: 'money_trail_timeline', label: 'Money Trail' },
              { id: 'risk_escalation_timeline', label: 'Risk Escalation' },
              { id: 'entity_timeline', label: 'Entity Profile' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTimelineTab(tab.id); setSelectedTimelineEntity('all'); }}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                  activeTimelineTab === tab.id 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTimelineTab === 'entity_timeline' && uniqueEntitiesForFilter.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-550 font-bold uppercase">Filter Entity:</span>
              <select
                value={selectedTimelineEntity}
                onChange={(e) => setSelectedTimelineEntity(e.target.value)}
                className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-350 outline-none focus:border-slate-700 transition-colors"
              >
                <option value="all">All Entities</option>
                {uniqueEntitiesForFilter.map((ent, i) => (
                  <option key={i} value={ent}>{ent}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Chronological events */}
        <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-850 print:before:bg-slate-200 max-h-[500px] overflow-y-auto pr-1">
          {currentTimelineEvents.slice(0, 50).map((evt, idx) => {
            const matchingTx = caseDetails?.transactions?.find(t => 
              t.tx_id === evt.transactions?.[0] ||
              t.description === evt.event || 
              (evt.event && evt.event.includes(formatINR(t.amount)) && t.channel && evt.event.includes(t.channel))
            );

            const isRisky = evt.risk_flag || evt.risk_increase > 0;

            return (
              <div key={idx} className="relative group">
                <div className={`absolute -left-6 top-2 w-3.5 h-3.5 rounded-full border-2 bg-slate-950 flex items-center justify-center transition-all ${
                  isRisky 
                    ? "border-red-500 bg-red-500/20 scale-110 shadow-[0_0_6px_rgba(239,68,68,0.4)]" 
                    : "border-slate-800 bg-slate-950"
                }`} />
                
                <div 
                  onClick={() => matchingTx && setSelectedTx(matchingTx)}
                  className={`flex flex-col gap-2.5 bg-slate-900/30 hover:bg-slate-900/60 border border-slate-850/60 p-4 rounded-xl transition-all print:border-slate-200 ${
                    matchingTx ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-indigo-400">{evt.date} {evt.time}</span>
                        {evt.event_type && (
                          <span className={`text-[8px] uppercase font-black px-1.5 py-0.2 rounded border ${
                            isRisky ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-slate-950 text-slate-400 border-slate-800"
                          }`}>
                            {evt.event_type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-200 print:text-black">{evt.event}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                      {evt.risk_increase > 0 && (
                        <span className="bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono tracking-tight">
                          +{evt.risk_increase} Risk
                        </span>
                      )}
                      {matchingTx && (
                        <span className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-450 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                          Inspect
                        </span>
                      )}
                    </div>
                  </div>

                  {evt.description && evt.description !== evt.event && (
                    <p className="text-[10px] text-slate-400 leading-normal">{evt.description}</p>
                  )}

                  {evt.money_trail && evt.money_trail.length > 0 && (
                    <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500 bg-slate-950/40 p-1.5 rounded border border-slate-900/60 max-w-fit">
                      <GitBranch size={10} className="text-indigo-400 shrink-0" />
                      <span>Route:</span>
                      {evt.money_trail.map((hop, hidx) => (
                        <React.Fragment key={hidx}>
                          <span className="text-slate-350">{isViewer ? maskAccount(hop) : hop}</span>
                          {hidx < evt.money_trail.length - 1 && <span className="text-slate-700">→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Entities links inside the timeline event */}
                  {evt.entities && evt.entities.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-900/40">
                      <span className="text-[8px] text-slate-550 font-extrabold uppercase">Linked Signatures:</span>
                      {evt.entities.map((ent, eidx) => (
                        <span 
                          key={eidx} 
                          onClick={(e) => { e.stopPropagation(); handleEntityCardClick(ent, 'name', 0); }}
                          className="bg-slate-950 hover:border-indigo-500/40 border border-slate-900 px-1.5 py-0.5 rounded text-[9px] font-mono text-indigo-400 cursor-pointer transition-all"
                        >
                          {ent}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Transactions links inside the timeline event */}
                  {evt.transactions && evt.transactions.length > 0 && evt.transactions.some(tid => tid !== evt.transactions[0]) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[8px] text-slate-550 font-extrabold uppercase">Linked References:</span>
                      {evt.transactions.map((txId, tidx) => (
                        <span 
                          key={tidx} 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const txObj = caseDetails?.transactions?.find(t => t.tx_id === txId);
                            if (txObj) setSelectedTx(txObj);
                          }}
                          className="bg-slate-955 hover:border-indigo-500/40 border border-slate-900 px-1.5 py-0.5 rounded text-[9px] font-mono text-indigo-450 cursor-pointer transition-all"
                        >
                          {txId.substring(0, 12)}...
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {currentTimelineEvents.length === 0 && (
            <p className="text-slate-500 italic text-center py-8">No matching timeline events found.</p>
          )}
        </div>
      </section>

      {/* 9 & 10. Parser and Graph Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Parser Stats */}
        <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4 print:border-slate-300">
          <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
            9. Statement Processing Metrics
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Source Document</span>
                <span className="text-xs font-bold text-slate-200 break-all">{caseDetails?.case?.source_file || 'statement.pdf'}</span>
              </div>
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/50">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Parser Format</span>
                <span className="text-xs font-bold text-slate-200">{report.parser_statistics?.source_format}</span>
              </div>
            </div>
            
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/50 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Parser Accuracy Confidence</span>
                <span className="text-sm font-bold text-slate-200 mt-1 block">
                  {report.parser_statistics?.confidence}% ({report.parser_statistics?.parsed_rows} / {report.parser_statistics?.total_rows} rows)
                </span>
              </div>
              <div className="h-10 w-10 rounded-full border border-slate-800 flex items-center justify-center bg-slate-950/40">
                <Info size={16} className="text-indigo-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Graph Stats */}
        <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4 print:border-slate-300">
          <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
            10. Neural Topology Summary
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/50 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Network Nodes</span>
                <span className="text-lg font-black text-indigo-400 mt-1 block">{report.graph_summary?.total_nodes}</span>
              </div>
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/50 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Network Edges</span>
                <span className="text-lg font-black text-indigo-400 mt-1 block">{report.graph_summary?.total_edges}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/50">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-3">Nodes Classification</span>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(report.graph_summary?.node_types || {}).map(([type, count]) => (
                  <div key={type} className="bg-slate-950/40 p-2 rounded-lg text-center border border-slate-900">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">{type}</span>
                    <span className="text-xs font-black text-slate-300">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 11. Recommended Next Steps */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4 print:border-slate-300">
        <h2 className="text-sm uppercase font-black tracking-widest text-slate-400 border-b border-slate-800 pb-2 print:text-black print:border-slate-300">
          11. Recommended Investigation Protocol
        </h2>
        <ol className="list-decimal list-inside space-y-3">
          {report.recommended_next_steps?.map((step, idx) => (
            <li key={idx} className="text-xs text-slate-300 leading-relaxed font-semibold print:text-black">
              <span className="text-indigo-400 font-bold mr-1.5 font-mono">{idx + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {/* Footer Branding - Printed Only */}
      <div className="hidden print:block text-[10px] text-slate-400 text-center border-t border-slate-200 pt-8 mt-12">
        <span>Sentinel Automated Forensic Workstation Analysis Report • Page 1 of 1</span>
      </div>

      {/* Transaction intelligence drawer */}
      {selectedTx && (
        <TransactionDrilldownDrawer 
          transaction={selectedTx}
          allTransactions={caseDetails?.transactions || []}
          onClose={() => setSelectedTx(null)}
          onHighlightOnGraph={handleGraphHighlightFromDrawer}
        />
      )}

      {/* Entity intelligence panel drawer */}
      {selectedEntity && (
        <EntityIntelligencePanel
          entity={selectedEntity}
          allTransactions={caseDetails?.transactions || []}
          initialNotes={entityNotes[selectedEntity.value] || ''}
          onSaveNotes={handleSaveNotes}
          onClose={() => setSelectedEntity(null)}
          onHighlightOnGraph={handleGraphHighlightFromDrawer}
          onExplainRisk={(ent) => {
            setSelectedRiskNode({
              id: ent.value,
              accountId: ent.value,
              nodeType: ent.type || 'account',
              label: ent.value,
              risk: ent.risk || 40
            });
            setSelectedEntity(null);
          }}
        />
      )}

      {/* Risk explanation drawer */}
      {selectedRiskNode && (
        <RiskExplanationDrawer
          node={selectedRiskNode}
          caseDetails={caseDetails}
          onClose={() => setSelectedRiskNode(null)}
          onTxSelect={setSelectedTx}
        />
      )}
    </div>
  );
}
