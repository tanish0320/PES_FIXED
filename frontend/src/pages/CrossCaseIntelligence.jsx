import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../hooks/useDataStore';
import { 
  GitBranch, ShieldAlert, Network, Search, ArrowRight, 
  Compass, ZoomIn, RefreshCw, FileText, Info, 
  DollarSign, Activity, Users, Landmark, AlertCircle
} from 'lucide-react';
import cytoscape from 'cytoscape';

export default function CrossCaseIntelligence() {
  const navigate = useNavigate();
  const { cases, fetchCrossStatementIntelligence } = useDataStore();
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'entities' | 'beneficiaries' | 'hubs' | 'trails' | 'graph' | 'history' | 'similarity' | 'risk'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistoryEntity, setSelectedHistoryEntity] = useState('');

  const cyRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await fetchCrossStatementIntelligence();
      setData(res);
      setLoading(false);
      
      // Auto-select first shared entity for history
      if (res?.shared_entities?.length > 0) {
        setSelectedHistoryEntity(res.shared_entities[0].value);
      }
    }
    loadData();
  }, []);

  // Relationship Graph Cytoscape layout hook
  useEffect(() => {
    if (activeTab !== 'graph' || !data?.relationship_graph || !cyRef.current) return;

    const cy = cytoscape({
      container: cyRef.current,
      elements: [
        ...data.relationship_graph.nodes,
        ...data.relationship_graph.edges
      ],
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#f8fafc',
            'font-size': '9px',
            'font-weight': 'bold',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#1e293b',
            'border-width': '2px',
            'border-color': '#475569',
            'width': '50px',
            'height': '50px',
            'text-wrap': 'wrap',
            'text-max-width': '45px'
          }
        },
        {
          selector: 'node[nodeType="investigation"]',
          style: {
            'background-color': '#4f46e5',
            'border-color': '#6366f1',
            'width': '70px',
            'height': '70px',
            'font-size': '10px'
          }
        },
        {
          selector: 'node[nodeType="upi_id"]',
          style: {
            'background-color': '#059669',
            'border-color': '#10b981'
          }
        },
        {
          selector: 'node[nodeType="account"]',
          style: {
            'background-color': '#2563eb',
            'border-color': '#3b82f6'
          }
        },
        {
          selector: 'node[nodeType="merchant"]',
          style: {
            'background-color': '#d97706',
            'border-color': '#f59e0b'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#334155',
            'target-arrow-color': '#334155',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(relation)',
            'font-size': '7px',
            'color': '#94a3b8',
            'text-background-opacity': 0.8,
            'text-background-color': '#0f172a',
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle'
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: true,
        padding: 40,
        nodeOverlap: 20
      }
    });

    return () => cy.destroy();
  }, [activeTab, data]);

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

  const handleHighlightGraph = (caseId, txIds, nodeIds) => {
    sessionStorage.setItem('highlight_txs', JSON.stringify(txIds));
    sessionStorage.setItem('highlight_nodes', JSON.stringify(nodeIds));
    navigate(`/graph/${caseId}`);
  };

  const handleOpenTimeline = (caseId) => {
    sessionStorage.setItem('open_timeline', 'true');
    navigate(`/graph/${caseId}`);
  };

  const handleOpenReplay = (caseId) => {
    sessionStorage.setItem('start_replay', 'true');
    navigate(`/graph/${caseId}`);
  };

  // Filtered lists
  const filteredEntities = useMemo(() => {
    const list = data?.shared_entities || [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(e => 
      String(e.value).toLowerCase().includes(q) ||
      String(e.type).toLowerCase().includes(q) ||
      e.case_names?.some(n => n.toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  const selectedEntityHistory = useMemo(() => {
    if (!selectedHistoryEntity || !data?.shared_entities) return null;
    return data.shared_entities.find(e => e.value === selectedHistoryEntity);
  }, [selectedHistoryEntity, data]);

  const riskProgressionForHistory = useMemo(() => {
    if (!selectedHistoryEntity || !data?.risk_propagation) return null;
    return data.risk_propagation.find(e => e.value === selectedHistoryEntity);
  }, [selectedHistoryEntity, data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-450 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Aggregating Cross-Case Intelligence...</h3>
        <p className="text-[10px] font-mono text-slate-600">Cross-referencing entities, trails, and routing matrices...</p>
      </div>
    );
  }

  if (!data?.active) {
    return (
      <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-6">
        <div className="bg-slate-900/60 border border-slate-850 p-8 rounded-2xl text-center space-y-4 flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-indigo-950/40 border border-indigo-900/30 flex items-center justify-center text-indigo-400">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm uppercase font-black text-white tracking-widest">Cross-Statement Intelligence Offline</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Cross-case correlation matrices require **multiple statement files** to be uploaded. Upload at least 2 bank statements in the upload section to unlock hidden links.
            </p>
          </div>
          <button 
            onClick={() => navigate('/upload')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg text-xs transition-colors"
          >
            Upload Statement File
          </button>
        </div>
      </div>
    );
  }

  const kpis = data.summary;

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start pb-4 border-b border-slate-900">
        <div>
          <h1 className="text-lg font-black tracking-widest text-white uppercase flex items-center gap-2">
            <GitBranch className="text-indigo-400" size={20} />
            Cross-Case Intelligence Dashboard
          </h1>
          <p className="text-[10px] text-slate-500 font-mono font-bold mt-1 uppercase">
            Global Forensic Link-Analysis & Routing Matrix across {kpis.total_investigations} Cases
          </p>
        </div>
        <span className="bg-indigo-950/40 border border-indigo-900/30 px-3 py-1 rounded-lg text-[9px] font-mono font-bold text-indigo-400 uppercase">
          AI Correlation Hub Active
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 border border-slate-850 rounded-xl p-1 gap-1 flex-wrap shrink-0">
        {[
          { id: 'dashboard', label: 'Overview' },
          { id: 'entities', label: 'Shared Entities' },
          { id: 'beneficiaries', label: 'Beneficiaries' },
          { id: 'hubs', label: 'Routing Hubs' },
          { id: 'trails', label: 'Cross-Case Trails' },
          { id: 'graph', label: 'Relationship Graph' },
          { id: 'history', label: 'Profile History' },
          { id: 'risk', label: 'Risk Propagation' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
              activeTab === tab.id 
                ? "bg-indigo-600 text-white shadow-md" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TABS CONTENT */}

      {/* 1. Dashboard Overview */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-[10px] font-black uppercase">Cases Correlated</span>
                <Landmark size={14} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{kpis.total_investigations}</p>
            </div>
            
            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-[10px] font-black uppercase">Shared Entities</span>
                <Users size={14} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{kpis.shared_entities}</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-[10px] font-black uppercase">Routing Hubs</span>
                <Network size={14} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{kpis.bridge_accounts}</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-[10px] font-black uppercase">Cross-Case Trails</span>
                <GitBranch size={14} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{kpis.cross_case_money_trails}</p>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <h3 className="text-xs uppercase font-black text-slate-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-400" /> Critical Risk Profiles
              </h3>
              <div className="space-y-3">
                <div className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase font-black">Highest Risk Shared Entity</span>
                    <p className="text-xs font-mono font-bold text-red-400 mt-0.5">{kpis.highest_risk_shared_entity}</p>
                  </div>
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[8px] font-bold">CRITICAL</span>
                </div>

                <div className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase font-black">Most Connected Investigation</span>
                    <p className="text-xs font-mono font-bold text-slate-300 mt-0.5">{kpis.most_connected_investigation}</p>
                  </div>
                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[8px] font-bold">HUBS LINKED</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <h3 className="text-xs uppercase font-black text-slate-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <Info size={14} className="text-indigo-400" /> Cross-Case Linkage Matrix
              </h3>
              <div className="text-[11px] text-slate-400 leading-relaxed space-y-2">
                <p>
                  SENTINEL has correlated all statement files uploaded to this workstation. The system has automatically isolated nodes that bridge multiple different bank accounts.
                </p>
                <p>
                  Select tabs above to inspect shared entities, trace fund flows moving through secondary bridge statements, and interrogate the multi-case neural topology map.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Shared Entities */}
      {activeTab === 'entities' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search shared entities, cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 py-2 pl-9 pr-4 rounded-xl text-xs text-slate-200 outline-none focus:border-slate-700 font-semibold"
            />
          </div>

          <div className="bg-slate-900/20 border border-slate-850 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-850 text-slate-500 uppercase font-black tracking-wider">
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Investigations</th>
                  <th className="py-3 px-4 text-center">Transactions</th>
                  <th className="py-3 px-4 text-right">Money Sent</th>
                  <th className="py-3 px-4 text-right">Money Received</th>
                  <th className="py-3 px-4 text-center">Combined Risk</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredEntities.map((ent, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/30 text-slate-350">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">{ent.value}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-[9px] font-bold uppercase text-indigo-400">
                        {ent.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[200px] truncate" title={ent.case_names.join(', ')}>
                      {ent.case_names.join(', ')}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">{ent.num_transactions}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-red-400">{formatINR(ent.money_sent)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400">{formatINR(ent.money_received)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        ent.risk_score >= 60 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {Math.round(ent.risk_score)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => {
                            setSelectedHistoryEntity(ent.value);
                            setActiveTab('history');
                          }}
                          className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[9px] px-2.5 py-1 rounded font-bold uppercase"
                        >
                          History
                        </button>
                        <button
                          onClick={() => navigate(`/report/${ent.cases[0]}`)}
                          className="bg-indigo-950/20 hover:bg-indigo-900/40 border border-indigo-900/30 text-indigo-400 text-[9px] px-2.5 py-1 rounded font-bold uppercase"
                        >
                          Report
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredEntities.length && (
                  <tr>
                    <td colSpan="8" className="py-6 text-center text-slate-500 italic">No matching shared entities found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Repeated Beneficiaries */}
      {activeTab === 'beneficiaries' && (
        <div className="space-y-4">
          <div className="bg-slate-900/20 border border-slate-850 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-850 text-slate-500 uppercase font-black tracking-wider">
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Investigations linked</th>
                  <th className="py-3 px-4 text-right">Money Received</th>
                  <th className="py-3 px-4 text-center">Risk Score</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {data.repeated_beneficiaries.map((ben, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/30 text-slate-350">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">{ben.beneficiary}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-855 text-[9px] font-black uppercase text-emerald-400">
                        {ben.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{ben.cases_appeared} statements</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">{formatINR(ben.money_received)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                        {Math.round(ben.risk_score)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => {
                            setSelectedHistoryEntity(ben.beneficiary);
                            setActiveTab('history');
                          }}
                          className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[9px] px-2 py-1 rounded font-bold"
                        >
                          ENTITY PROFILE
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.repeated_beneficiaries.length && (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-slate-500 italic">No repeated beneficiaries found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Routing Hubs */}
      {activeTab === 'hubs' && (
        <div className="space-y-4">
          <div className="bg-slate-900/20 border border-slate-850 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-850 text-slate-500 uppercase font-black tracking-wider">
                  <th className="py-3 px-4">Bridge Entity</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Bridge Score</th>
                  <th className="py-3 px-4 text-center">Centrality</th>
                  <th className="py-3 px-4 text-right">Money Routed</th>
                  <th className="py-3 px-4">Investigations linked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {data.bridge_accounts.map((hub, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/30 text-slate-350">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">{hub.value}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-[9px] font-bold uppercase text-indigo-400">
                        {hub.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-400">{hub.bridge_score}</td>
                    <td className="py-3.5 px-4 text-center font-mono">{hub.centrality}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">{formatINR(hub.money_routed)}</td>
                    <td className="py-3.5 px-4 truncate max-w-[200px]">{hub.connected_investigations.join(', ')}</td>
                  </tr>
                ))}
                {!data.bridge_accounts.length && (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-slate-500 italic">No routing hubs detected.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Cross-Case Money Trails */}
      {activeTab === 'trails' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.cross_case_money_trails.map((trail, idx) => (
            <div key={idx} className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-mono text-indigo-400 font-bold">{trail.trail_id}</span>
                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[8px] font-bold">
                  Risk: {trail.risk_score}%
                </span>
              </div>

              {/* Hops map */}
              <div className="flex items-center gap-2 font-mono text-[9px] bg-slate-950/40 p-2 rounded border border-slate-900 max-w-fit">
                <span className="text-indigo-400 font-bold">Case: {trail.route[0]}</span>
                <ArrowRight size={10} className="text-slate-600" />
                <span className="text-slate-200 font-black">{trail.route[1]}</span>
                <ArrowRight size={10} className="text-slate-600" />
                <span className="text-indigo-400 font-bold">Case: {trail.route[2]}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <span className="text-slate-500 block">Total Amount</span>
                  <span className="font-mono font-bold text-slate-200">{formatINR(trail.total_amount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Hop Interval</span>
                  <span className="font-bold text-slate-200">{trail.duration}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-850/40">
                <button
                  onClick={() => handleHighlightGraph(trail.linked_cases[0], [trail.trail_id], [trail.route[1]])}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 text-slate-350"
                >
                  <Compass size={10} /> Highlight
                </button>
                <button
                  onClick={() => handleOpenReplay(trail.linked_cases[0])}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 text-slate-350"
                >
                  <RefreshCw size={10} /> Replay
                </button>
                <button
                  onClick={() => navigate(`/report/${trail.linked_cases[0]}`)}
                  className="flex-1 bg-indigo-950/20 hover:bg-indigo-900/40 border border-indigo-900/30 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 text-indigo-400"
                >
                  <FileText size={10} /> Report
                </button>
              </div>
            </div>
          ))}
          {!data.cross_case_money_trails.length && (
            <p className="col-span-2 text-center py-12 text-slate-500 italic text-xs">No cross-case money trails detected.</p>
          )}
        </div>
      )}

      {/* 6. Relationship Graph */}
      {activeTab === 'graph' && (
        <div className="space-y-4">
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 space-y-2">
            <h3 className="text-xs uppercase font-black text-slate-400">Investigation Relationship Graph</h3>
            <p className="text-[10px] text-slate-500 font-mono">Visualizes linked connections between individual cases (blue nodes represent cases; other nodes represent shared counterparties).</p>
            <div ref={cyRef} className="w-full h-[600px] bg-slate-950 border border-slate-900 rounded-xl mt-3 relative overflow-hidden" />
          </div>
        </div>
      )}

      {/* 7. Profile History */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 uppercase font-black">Interrogate Entity Profile:</span>
            <select
              value={selectedHistoryEntity}
              onChange={(e) => setSelectedHistoryEntity(e.target.value)}
              className="bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none"
            >
              {data.shared_entities.map((ent, i) => (
                <option key={i} value={ent.value}>{ent.value} ({ent.type})</option>
              ))}
            </select>
          </div>

          {selectedEntityHistory && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* History Timeline Map */}
              <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-5 space-y-4 md:col-span-2">
                <h3 className="text-xs uppercase font-black text-slate-400 border-b border-slate-800 pb-2">
                  Multi-Case Linkage Flow
                </h3>
                
                {/* Visual arrow sequence */}
                <div className="flex flex-col md:flex-row items-center gap-4 py-6 justify-center">
                  {selectedEntityHistory.linked_investigations.map((inv, idx) => (
                    <React.Fragment key={idx}>
                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center space-y-1.5 min-w-[150px]">
                        <span className="text-[8px] text-slate-500 uppercase font-black">Case Step {idx+1}</span>
                        <p className="text-xs font-bold text-white truncate max-w-[130px]">{inv.name}</p>
                        <p className="text-[9px] font-mono text-slate-550">{inv.id}</p>
                      </div>
                      {idx < selectedEntityHistory.linked_investigations.length - 1 && (
                        <ArrowRight className="text-indigo-400 rotate-90 md:rotate-0" size={16} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="border-t border-slate-800/80 pt-4 space-y-2 text-[11px] text-slate-400">
                  <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider block">Explainability Link Reasons</span>
                  <ul className="list-disc list-inside space-y-1.5 pl-1">
                    {selectedEntityHistory.reasons.map((res, i) => (
                      <li key={i}>{res}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Mini stats profile */}
              <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs uppercase font-black text-slate-400 border-b border-slate-800 pb-2">
                  Risk & Money Profile
                </h3>

                <div className="space-y-3.5">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase font-black block">First Seen</span>
                    <span className="text-xs font-mono font-bold text-slate-200">{selectedEntityHistory.first_seen}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase font-black block">Last Seen</span>
                    <span className="text-xs font-mono font-bold text-slate-200">{selectedEntityHistory.last_seen}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase font-black block">Combined Risk score</span>
                    <span className="bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-block mt-0.5">
                      {Math.round(selectedEntityHistory.risk_score)}% Risk
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase font-black block">Combined Confidence</span>
                    <span className="text-xs font-mono font-bold text-slate-200">{Math.round(selectedEntityHistory.confidence_score)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. Risk Propagation */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          <div className="bg-slate-900/20 border border-slate-850 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-850 text-slate-500 uppercase font-black tracking-wider">
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Current Case Risk</th>
                  <th className="py-3 px-4 text-center">Historical Case Risk</th>
                  <th className="py-3 px-4 text-center">Combined Risk</th>
                  <th className="py-3 px-4 text-center">Risk Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {data.risk_propagation.map((prop, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/30 text-slate-350">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">{prop.value}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-[9px] font-bold uppercase text-indigo-400">
                        {prop.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">{Math.round(prop.current_risk)}%</td>
                    <td className="py-3.5 px-4 text-center font-mono">{Math.round(prop.historical_risk)}%</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-red-400">{Math.round(prop.combined_risk)}%</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                        prop.risk_trend === 'increasing' 
                          ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                          : (prop.risk_trend === 'decreasing' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400")
                      }`}>
                        {prop.risk_trend}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
