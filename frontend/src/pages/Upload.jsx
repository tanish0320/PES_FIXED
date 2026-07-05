import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload as UploadIcon, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  Loader2, 
  Trash2, 
  Sparkles,
  Info,
  AlertCircle
} from 'lucide-react';
import { useDataStore } from '../hooks/useDataStore';
import Particles from '../components/Particles';

export default function Upload() {
  const navigate = useNavigate();
  const { uploadStatements, seedDemo, loading: storeLoading, error: storeError } = useDataStore();
  
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files);
    }
  };

  const handleFileSelection = (selectedFiles) => {
    const validExtensions = ['pdf', 'csv', 'xlsx', 'xls', 'txt'];
    const newFiles = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const ext = file.name.split('.').pop().toLowerCase();
      if (validExtensions.includes(ext)) {
        // Prevent duplicate file names in the current queue
        if (!files.some(f => f.name === file.name)) {
          newFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            file,
            name: file.name,
            size: formatBytes(file.size)
          });
        }
      }
    }
    
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      setError(null);
      setResults(null);
    }
  };

  const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (files.length <= 1) {
      setResults(null);
    }
  };

  const clearQueue = () => {
    setFiles([]);
    setResults(null);
    setError(null);
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const triggerAnalysis = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setResults(null);

    try {
      const fileObjects = files.map(f => f.file);
      const data = await uploadStatements(fileObjects);
      setResults(data);
    } catch (err) {
      setError(err.message || "Failed to process bank statement files.");
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
    <div className="flex flex-col items-center justify-center min-h-[85vh] p-6 text-gray-100 relative overflow-hidden bg-slate-950">
      {/* Particles Background - Only in Content Area */}
      <div className="absolute inset-0 z-0">
        <Particles
          particleColors={["#ffffff", "#3b82f6", "#60a5fa"]}
          particleCount={250}
          particleSpread={12}
          speed={0.1}
          particleBaseSize={80}
          moveParticlesOnHover={true}
          alphaParticles={true}
          disableRotation={false}
        />
      </div>

      <div className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-semibold mb-3">
            <Sparkles size={12} />
            Unified Multi-Statement Workspace
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
            Upload Financial Statements
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-lg mx-auto">
            Analyze multiple formats simultaneously (PDF, CSV, XLSX, XLS, TXT). SENTINEL will parse them independently and merge them into a single investigation.
          </p>
        </div>

        {/* Drag and Drop Zone */}
        <form 
          onDragEnter={handleDrag} 
          onDragOver={handleDrag} 
          onDragLeave={handleDrag} 
          onDrop={handleDrop}
          onSubmit={(e) => e.preventDefault()}
          className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-300 ${
            dragActive ? "border-blue-500 bg-blue-500/10" : "border-slate-800 hover:border-slate-700 bg-slate-950/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.csv,.xlsx,.xls,.txt"
            onChange={handleChange}
          />
          
          <div className="bg-slate-800/80 p-4 rounded-full mb-3 text-blue-400 shadow-md">
            <UploadIcon size={28} />
          </div>

          <p className="text-sm font-semibold mb-1">
            Drag and drop multiple statements here
          </p>
          <p className="text-xs text-slate-500 mb-5 text-center max-w-md">
            Supports Axis, Kotak, Union, PNB, SBI, ICORE formats. One bad file will not disrupt successfully parsed statements.
          </p>

          <button 
            type="button" 
            onClick={onButtonClick}
            disabled={uploading}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 hover:border-slate-600 text-gray-200 px-5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          >
            Select Files from Device
          </button>
        </form>

        {/* Upload Queue */}
        {files.length > 0 && (
          <div className="mt-8 bg-slate-950/30 border border-slate-850 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Upload Queue ({files.length} {files.length === 1 ? 'file' : 'files'})
              </span>
              {!uploading && (
                <button 
                  onClick={clearQueue}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold transition-all"
                >
                  Clear Queue
                </button>
              )}
            </div>

            <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
              {files.map((item) => {
                // Find matching file stats if results are available
                const fileStats = results?.case?.files_uploaded?.find(f => f.filename === item.name);
                
                return (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800/60 hover:border-slate-800 rounded-lg transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-slate-800 text-slate-400 rounded-lg">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.size}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Live status indicators */}
                      {fileStats ? (
                        <div className="flex items-center gap-3">
                          {fileStats.status === 'SUCCESS' ? (
                            <>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">
                                Success
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {fileStats.rows_parsed} rows ({Math.round(fileStats.confidence)}%)
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold uppercase" title={fileStats.warnings?.join(', ')}>
                              Failed
                            </span>
                          )}
                        </div>
                      ) : uploading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="animate-spin text-blue-500" size={14} />
                          <span className="text-[10px] text-slate-400">Parsing...</span>
                        </div>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          Ready
                        </span>
                      )}

                      {!uploading && !results && (
                        <button 
                          onClick={() => removeFile(item.id)}
                          className="text-slate-500 hover:text-red-400 transition-all"
                          title="Remove file"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Run button */}
            {!uploading && !results && (
              <button
                onClick={triggerAnalysis}
                className="w-full mt-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-lg text-xs tracking-wider uppercase transition-all shadow-lg shadow-indigo-900/20"
              >
                Analyze {files.length} {files.length === 1 ? 'Statement' : 'Statements'}
              </button>
            )}
          </div>
        )}

        {/* Global Loading block */}
        {uploading && (
          <div className="mt-8 flex flex-col items-center justify-center p-8 bg-slate-950/20 border border-slate-850 rounded-xl">
            <Loader2 className="animate-spin text-blue-500 mb-3" size={28} />
            <p className="text-xs font-semibold text-slate-300">Merging Statement Data & Running Forensic Scans</p>
            <p className="text-[10px] text-slate-500 mt-1.5 max-w-xs text-center">
              Correlating accounts, tracing cross-statement money movements, and compiling visual intelligence models...
            </p>
          </div>
        )}

        {error && (
          <div className="mt-8 bg-red-950/20 border border-red-900/30 rounded-xl p-5 flex items-start gap-4 animate-shake">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-xs font-bold text-red-200 uppercase tracking-wide">Analysis Failed</h4>
              <p className="text-xs text-red-400 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Merged Results Presentation */}
        {results && (
          <div className="mt-8 bg-slate-950/60 border border-slate-850 rounded-xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle size={22} />
              <h3 className="text-base font-bold text-gray-100">Unified Investigation Constructed</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/40">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Investigation ID</span>
                <span className="text-xs font-mono font-bold text-blue-400">{results.case_id}</span>
              </div>
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/40">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Statements Associated</span>
                <span className="text-xs font-bold text-gray-200">
                  {results.case?.files_uploaded?.filter(f => f.status === 'SUCCESS').length} of {results.case?.files_uploaded?.length} files
                </span>
              </div>
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/40">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Total Transactions Merged</span>
                <span className="text-xs font-bold text-gray-200">{results.parser_stats?.parsed_rows} items</span>
              </div>
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/40">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Inflow/Outflow Accounts</span>
                <span className="text-xs font-bold text-gray-200">
                  {results.case?.account_ids?.length || 1} Primary Statements
                </span>
              </div>
            </div>

            {/* Check for failed files warnings */}
            {results.case?.files_uploaded?.some(f => f.status === 'FAILED') && (
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-4 flex gap-3 text-amber-400 text-xs">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Partial Ingest Warnings</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Some statements failed to parse and were skipped. The remaining files processed successfully.
                  </span>
                </div>
              </div>
            )}

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800/40">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Forensic Summary</span>
              <p className="text-xs text-slate-300 leading-relaxed mt-1.5 font-medium">
                {results.summary}
              </p>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={() => navigate(`/graph/${results.case_id}`)}
                className="flex-grow bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-indigo-500 hover:to-violet-500 text-white font-bold py-3 px-6 rounded-lg text-xs uppercase tracking-wider transition-all text-center shadow-md hover:scale-[1.01]"
              >
                Explore Money Flow Graph
              </button>
              <button
                onClick={() => navigate(`/report/${results.case_id}`)}
                className="bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-gray-300 font-semibold py-3 px-6 rounded-lg text-xs uppercase tracking-wider transition-all"
              >
                View Full Report
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info size={12} className="text-slate-400" />
            <span>Need sample statements? Use the button to load mock cases.</span>
          </div>
          <button
            type="button"
            onClick={handleSeed}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 px-3.5 py-1.5 rounded border border-slate-800 hover:border-slate-700 transition-all font-semibold disabled:opacity-50"
          >
            <Play size={11} className="fill-slate-300" />
            Seed Demo Statements
          </button>
        </div>
      </div>
    </div>
  );
}
