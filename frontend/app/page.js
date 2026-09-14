'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Activity,
  Upload,
  X,
  RefreshCcw,
  ExternalLink,
  Stethoscope,
  FileImage,
  Layers,
  Cpu,
  BrainCircuit,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const GITHUB_URL = "https://github.com/mirxa-hamza";

export default function PneumoniaScanner() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Results State
  const [result, setResult] = useState(null); // { label: string, confidence: number }
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Drag & Drop handlers
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Please upload a JPG, JPEG, or PNG chest X-ray image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('The selected image is larger than the 10 MB limit.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const resetWorkspace = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const analyzeScan = async () => {
    if (!selectedFile) return;

    setIsScanning(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'The prediction service could not analyze this image.');
      }

      const isPneumonia = data.prediction === 'pneumonia_positive';
      const confidence = Number(data.confidence);
      if (!Number.isFinite(confidence)) {
        throw new Error('The prediction service returned an invalid confidence score.');
      }

      setResult({
        label: isPneumonia ? 'Pneumonia Positive' : 'Normal / Pneumonia Negative',
        confidence,
        normalProbability: Number(data.normal_probability),
        pneumoniaProbability: Number(data.pneumonia_probability),
        threshold: Number(data.threshold),
      });

    } catch (err) {
      console.error("Backend Error:", err);
      setResult(null);
      setError(`${err.message} Start the local project with run_project.cmd, then try again.`);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* 1. Header Component */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <Activity size={24} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">PneumoScan AI</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-medium text-slate-600 text-sm">
            <a href="#scanner" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">Scanner</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How it Works</a>
            <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
          </nav>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors px-3 py-2 rounded-full hover:bg-blue-50"
          >
            <ExternalLink size={16} /> GitHub
          </a>
        </div>
      </header>

      <main className="flex-grow">
        {/* 2 & 3. Hero + Scanner Workspace: sized to fit one viewport below the header */}
        <section
          id="scanner"
          className="relative overflow-hidden flex flex-col justify-center px-4 md:px-10"
          style={{ minHeight: '100dvh', paddingTop: '6rem', paddingBottom: '3rem' }}
        >
          {/* Decorative background accents */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-br from-blue-300 to-cyan-200 opacity-30 blur-3xl animate-float" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-gradient-to-br from-cyan-300 to-blue-200 opacity-25 blur-3xl animate-float" style={{ animationDelay: '1.2s' }} />

          <div className="relative max-w-7xl mx-auto w-full flex flex-col flex-1 gap-6 md:gap-8">
            {/* Hero */}
            <div className="text-center max-w-3xl mx-auto space-y-4 md:space-y-6 animate-fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold tracking-wider uppercase border border-blue-100">
                <Stethoscope size={14} /> Educational Local Model
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                Advanced <span className="text-blue-600 relative">
                  Pneumonia Detection
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-blue-200" preserveAspectRatio="none" viewBox="0 0 100 10">
                    <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4"></path>
                  </svg>
                </span> AI
              </h1>
              <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Upload a chest X-ray to run the trained classification model. The result is for education and demonstration only.
              </p>
            </div>

            {/* Interactive Scanner Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 items-stretch flex-1 min-h-0 animate-fade-up-delay">

              {/* Left Column: Upload & Preview */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5 h-full min-h-0">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative flex flex-col flex-1 min-h-0 transition-shadow duration-300 hover:shadow-2xl">

                  {/* Scanner Header */}
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                      <FileImage className="text-blue-500" size={20} />
                      <h2 className="font-semibold text-slate-800">Analysis Workspace</h2>
                    </div>
                    {selectedFile && (
                      <button
                        onClick={resetWorkspace}
                        className="text-sm font-medium text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                      >
                        <X size={16} /> Reset
                      </button>
                    )}
                  </div>

                  <div className="p-6 md:p-8 flex flex-col flex-1 min-h-0">
                    {!selectedFile ? (
                      <button
                        type="button"
                        aria-label="Choose a chest X-ray image"
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center flex-1 min-h-[260px] max-h-[420px] transition-all duration-300 ${
                          isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-slate-50/80'
                        }`}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileInput}
                          accept="image/jpeg, image/png, image/jpg"
                          className="hidden"
                        />
                        <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 text-blue-600 animate-float">
                          <Upload size={26} />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Drag &amp; Drop X-Ray Scan</h3>
                        <p className="text-slate-500 text-sm max-w-xs mb-6">
                          Supported formats: JPG, PNG (max 10MB)
                        </p>
                        <span className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all hover:-translate-y-0.5">
                          Browse Files
                        </span>
                      </button>
                    ) : (
                      <div className="relative flex-1 min-h-[260px] max-h-[420px] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                        <img
                          src={previewUrl}
                          alt="X-Ray Preview"
                          className={`h-full w-full object-contain ${isScanning ? 'opacity-80 scale-105 filter grayscale contrast-125' : ''} transition-all duration-700`}
                        />

                        {/* Scanning Pulse Animation Overlay */}
                        {isScanning && (
                          <>
                            <div className="absolute inset-0 bg-blue-600/20 mix-blend-overlay animate-pulse"></div>
                            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Actions / Status */}
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {isScanning ? (
                          <span className="flex items-center gap-2 text-blue-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                            Processing Neural Network Layers...
                          </span>
                        ) : selectedFile ? (
                          <span className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 size={16} />
                            Ready for analysis ({ (selectedFile.size / (1024 * 1024)).toFixed(2) } MB)
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-slate-500">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                            Awaiting upload...
                          </span>
                        )}
                      </div>

                      <button
                        onClick={analyzeScan}
                        disabled={!selectedFile || isScanning}
                        className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                      >
                        {isScanning ? (
                          <><RefreshCcw className="animate-spin" size={18} /> Analyzing...</>
                        ) : (
                          <><BrainCircuit size={18} /> Analyze Scan</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div role="alert" aria-live="assertive" className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-start gap-3 shrink-0 result-enter">
                    <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}
              </div>

              {/* Right Column: Result Display */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full min-h-0">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col flex-1 min-h-0 transition-shadow duration-300 hover:shadow-2xl">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2 shrink-0">
                    <Activity className="text-slate-500" size={20} />
                    <h3 className="font-semibold text-slate-800">Diagnostic Report</h3>
                  </div>

                  <div className="p-6 md:p-8 flex flex-col flex-1 min-h-0 overflow-y-auto">
                    {!result && !isScanning && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-4 py-8">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <Layers size={28} className="opacity-40" />
                        </div>
                        <p className="text-sm max-w-[200px] leading-relaxed">
                          Upload and analyze a scan to view AI diagnostic results here.
                        </p>
                      </div>
                    )}

                    {isScanning && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6" role="status" aria-live="polite" aria-busy="true">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                          <BrainCircuit className="text-blue-600 animate-pulse" size={24} />
                        </div>
                        <p className="text-sm font-medium text-slate-500 animate-pulse">Running inference...</p>
                      </div>
                    )}

                    {result && !isScanning && (
                      <div className="flex-1 flex flex-col result-enter">

                        {/* Dynamic Result Card */}
                        <div className={`p-6 rounded-xl flex flex-col items-center text-center relative overflow-hidden transition-colors border ${
                          result.label === 'Pneumonia Positive'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}>
                          <span className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">AI Finding</span>
                          <h4 className="text-2xl font-bold mb-6">
                            {result.label}
                          </h4>

                          <div className="w-full bg-white/50 backdrop-blur-sm rounded-lg p-4">
                            <div className="flex justify-between text-sm font-semibold mb-2">
                              <span className="opacity-70">Confidence Score</span>
                              <span className="font-mono">{Number(result.confidence).toFixed(1)}%</span>
                            </div>

                            {/* Progress Bar Container */}
                            <div className="w-full h-3 rounded-full overflow-hidden bg-slate-200/50">
                              {/* Animated Fill */}
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                  result.label === 'Pneumonia Positive' ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${result.confidence}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Secondary Analysis Details */}
                          <div className="mt-6 space-y-3">
                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Analysis Details</h5>

                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="text-sm font-medium text-slate-700">Normal probability</span>
                            <span className="text-sm font-bold text-slate-800">{result.normalProbability.toFixed(1)}%</span>
                          </div>

                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="text-sm font-medium text-slate-700">Pneumonia probability</span>
                            <span className="text-sm font-bold text-slate-800">{result.pneumoniaProbability.toFixed(1)}%</span>
                          </div>

                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="text-sm font-medium text-slate-700">Decision threshold</span>
                            <span className="text-sm font-bold text-slate-800">{result.threshold.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. How It Works Section */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 md:px-10 pt-24 pb-16 border-t border-slate-200">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">The project validates an uploaded image, runs the trained model, and returns the model probabilities with a fixed decision threshold.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 border border-blue-100">
                <span className="font-bold text-lg">1</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-3">Image Ingestion</h3>
              <p className="text-slate-600 text-sm leading-relaxed">The application accepts JPG, JPEG, and PNG images under 10 MB, then uses the trained model preprocessing consistently.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 border border-blue-100">
                <span className="font-bold text-lg">2</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-3">Neural Inference</h3>
              <p className="text-slate-600 text-sm leading-relaxed">The EfficientNet B0 model estimates the probability of the two trained labels: normal and pneumonia positive.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 border border-blue-100">
                <span className="font-bold text-lg">3</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-3">Output Generation</h3>
              <p className="text-slate-600 text-sm leading-relaxed">The interface presents the prediction, confidence, and both class probabilities without inventing additional medical findings.</p>
            </div>
          </div>

          <div className="mt-10 bg-slate-900 text-white p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between shadow-xl gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-slate-800 p-3 rounded-lg"><Cpu className="text-cyan-400" size={24} /></div>
              <div>
                <h4 className="font-bold text-lg">Backend Architecture</h4>
                <p className="text-slate-400 text-sm">Python FastAPI • PyTorch (EfficientNet-B0) • Next.js</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-slate-800 rounded font-mono text-xs text-slate-300 border border-slate-700">
              v1.4.2-stable
            </div>
          </div>
        </section>

      </main>

      {/* 5. Footer Component */}
      <footer id="about" className="bg-slate-900 text-slate-400 border-t border-slate-800 mt-auto">
        {/* Medical Disclaimer Banner */}
        <div className="bg-rose-950 text-rose-300 py-3 px-4 text-center text-xs font-medium tracking-wide uppercase flex items-center justify-center gap-2 border-b border-rose-900/50">
          <AlertTriangle size={16} />
          Medical Disclaimer: This AI tool is for research &amp; demonstration purposes only and does not replace professional clinical diagnosis.
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-10 py-14 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2 text-slate-300 font-bold text-lg">
              <Activity size={20} /> PneumoScan AI
            </div>
            <p className="text-sm">Designed &amp; Developed by Hamza Mustafa</p>
          </div>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all hover:-translate-y-0.5 text-sm font-medium border border-slate-700 hover:border-slate-600"
          >
            <ExternalLink size={18} /> GitHub Repository
          </a>
        </div>
      </footer>
    </div>
  );
}
