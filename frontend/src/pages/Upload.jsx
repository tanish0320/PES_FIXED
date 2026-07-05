import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileText, CheckCircle, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { useDataStore } from '../hooks/useDataStore';
import LightPillar from '../components/LightPillar';

export default function Upload() {
  const navigate = useNavigate();
  const { uploadStatement, seedDemo, loading: storeLoading, error: storeError } = useDataStore();
  
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const processFile = async (file) => {
    setSelectedFile(file);
    setUploading(true);
    setError(null);
    setResults(null);

    try {
      const data = await uploadStatement(file);
      setResults(data);
    } catch (err) {
      setError(err.message || "Failed to process bank statement.");
    } finally {
      setUploading(false);
    }
  };

  const handleSeed = async () => {
    setError(null);
    setResults(null);
    setUploading(true);
    try {
      const data = await seedDemo();
      alert(`Successfully seeded ${data.seeded_count} demo files!`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || "Failed to seed demo data.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-gray-100 relative overflow-hidden bg-slate-950">
      {/* LightPillar Background - Fill content area only */}
      <div className="absolute inset-0 z-0 w-full h-full">
        <LightPillar
          topColor="#3B82F6"
          bottomColor="#1E40AF"
          intensity={0.7}
          rotationSpeed={0.3}
          glowAmount={0.006}
          pillarWidth={3.0}
          pillarHeight={0.4}
          noiseIntensity={0.5}
          interactive={false}
          mixBlendMode="normal"
          quality="high"
        />
      </div>

      {/* Content Card - Centered on top */}
      <div className="w-full max-w-2xl bg-slate-900/85 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Upload Financial Statements
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Analyze Axis, Kotak, Union, SBI bank statements (.pdf, .csv, .xlsx, .xls, .txt)
          </p>
        </div>

        <form 
          onDragEnter={handleDrag} 
          onDragOver={handleDrag} 
          onDragLeave={handleDrag} 
          onDrop={handleDrop}
          onSubmit={(e) => e.preventDefault()}
          className={`relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-all duration-300 ${
            dragActive ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:border-slate-600 bg-slate-950/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.csv,.xlsx,.xls,.txt"
            onChange={handleChange}
          />
          
          <div className="bg-slate-800 p-4 rounded-full mb-4 text-blue-400 shadow-lg">
            <UploadIcon size={32} />
          </div>

          <p className="text-base font-semibold mb-1">
            Drag and drop your statement file here
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Supports PDF tables, Axis CSV, Kotak tab-separated, ICORE/SBI CSV, and PNB/KGB TXT
          </p>

          <button 
            type="button" 
            onClick={onButtonClick}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-md transition-all"
          >
            Select File from Device
          </button>
        </form>

        {uploading && (
          <div className="mt-8 flex flex-col items-center justify-center p-6 bg-slate-950/30 border border-slate-800/80 rounded-xl">
            <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
            <p className="text-sm font-medium">Processing statement: {selectedFile?.name}</p>
            <p className="text-xs text-slate-500 mt-1">Extracting transactions, nodes, and patterns...</p>
          </div>
        )}

        {error && (
          <div className="mt-8 bg-red-950/30 border border-red-900/50 rounded-xl p-5 flex items-start gap-4">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-bold text-red-200">Analysis Failed</h4>
              <p className="text-xs text-red-400 mt-1">{error}</p>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-8 bg-slate-950/60 border border-slate-850 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4 text-emerald-400">
              <CheckCircle size={24} />
              <h3 className="text-lg font-bold text-gray-100">Statement Analyzed Successfully</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/50">
                <span className="text-xs text-slate-400 block mb-1">Investigation ID</span>
                <span className="text-sm font-mono font-bold text-blue-400">{results.case_id}</span>
              </div>
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/50">
                <span className="text-xs text-slate-400 block mb-1">Primary Account</span>
                <span className="text-sm font-mono font-bold text-gray-200">{results.case?.account_id}</span>
              </div>
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/50">
                <span className="text-xs text-slate-400 block mb-1">Parser Format</span>
                <span className="text-sm font-bold text-gray-200">{results.parser_stats?.source_format}</span>
              </div>
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/50">
                <span className="text-xs text-slate-400 block mb-1">Confidence Score</span>
                <span className={`text-sm font-bold ${
                  results.parser_stats?.confidence > 80 ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {results.parser_stats?.confidence}% ({results.parser_stats?.parsed_rows}/{results.parser_stats?.total_rows} rows)
                </span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800/50 mb-6">
              <span className="text-xs text-slate-400 block mb-1">Executive Summary</span>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                {results.summary}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => navigate(`/graph/${results.case_id}`)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-lg text-sm shadow-lg shadow-indigo-900/30 transition-all text-center"
              >
                Explore Money Flow Graph
              </button>
              <button
                onClick={() => navigate(`/report/${results.case_id}`)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 font-semibold py-3 px-6 rounded-lg text-sm transition-all"
              >
                View Full Report
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>Need sample statements? Use the button on the right to populate the system.</span>
          <button
            type="button"
            onClick={handleSeed}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition-all font-medium disabled:opacity-50"
          >
            <Play size={12} />
            Seed Demo Statements
          </button>
        </div>
      </div>
    </div>
  );
}
