/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Copy,
  Terminal,
  AlertCircle,
  Briefcase,
  Award,
  Zap,
  ChevronDown,
  ChevronUp,
  BookOpen,
  History,
  Trash2,
  Bookmark,
  Clock,
  Save,
  Check,
  LogIn,
  LogOut,
  UserPlus,
  User as UserIcon
} from "lucide-react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "./firebase";
import { AuthModal } from "./components/AuthModal";


// Minimal valid PDF generator for 1-click instant demo testing
function createSamplePdfFile(): File {
  const pdfString = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 260 >> stream
BT
/F1 12 Tf
72 712 Td
(Alex Vance - Senior Lead Backend Architect) Tj
0 -20 Td
(Experience: Led a squad of 14 distributed software engineers across 3 squads.) Tj
0 -20 Td
(Designed scalable REST APIs and microservices handling 12M daily requests.) Tj
0 -20 Td
(Commercial impact: Grew annual recurring revenue by 40% via API platform.) Tj
0 -20 Td
(Skills: Python, REST API Architecture, Team Leadership, Reliability Engineering) Tj
ET
endstream endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000101 00000 n
0000000225 00000 n
0000000293 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
600
%%EOF`;

  const blob = new Blob([pdfString], { type: "application/pdf" });
  return new File([blob], "Alex_Vance_Senior_Lead_CV.pdf", { type: "application/pdf" });
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDesc, setJobDesc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [animScore, setAnimScore] = useState<number>(0);
  const [showVerification, setShowVerification] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("fitscore_history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse fitscore history", e);
      }
    }
  }, []);

  const handleSaveToHistory = () => {
    if (!result) return;
    
    // Check if already saved
    const exists = history.some(item => JSON.stringify(item.result) === JSON.stringify(result));
    if (exists) {
      setSaveStatus("Already Saved!");
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    const fileNameToSave = file ? file.name : "Uploaded_CV.pdf";
    const titleToSave = file ? file.name.replace(/\.[^/.]+$/, "") : "CV Assessment";

    const newItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(),
      fileName: fileNameToSave,
      jobDesc: jobDesc,
      result: result,
      title: `${titleToSave} - ${result.overall_score}% Match`
    };

    const updated = [newItem, ...history];
    setHistory(updated);
    localStorage.setItem("fitscore_history", JSON.stringify(updated));
    setActiveHistoryId(newItem.id);
    setSaveStatus("Saved to History!");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleLoadHistoryItem = (item: any) => {
    setResult(item.result);
    setJobDesc(item.jobDesc);
    // Create a mock file so that handleSubmit has something
    const dummyBlob = new Blob([""], { type: "application/octet-stream" });
    setFile(new File([dummyBlob], item.fileName, { type: "application/octet-stream" }));
    setActiveHistoryId(item.id);
    setIsHistoryOpen(false); // Close the history panel/drawer
    setError(null);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid loading the item
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem("fitscore_history", JSON.stringify(updated));
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
    }
  };

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.map(item => {
      if (item.id === id) {
        return { ...item, title: editTitle.trim() || item.title };
      }
      return item;
    });
    setHistory(updated);
    localStorage.setItem("fitscore_history", JSON.stringify(updated));
    setEditingId(null);
  };

  // Animate circular score meter on result load
  useEffect(() => {
    if (result?.overall_score) {
      setAnimScore(0);
      const target = result.overall_score;
      const duration = 1200;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        setAnimScore(Math.round(target * ease));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleLoadSample = () => {
    const sampleFile = createSamplePdfFile();
    setFile(sampleFile);
    setJobDesc(
      "Looking for a Principal / Senior Lead Backend Engineer.\n\nKey Responsibilities:\n- People Management: Direct leadership and mentoring of engineering teams.\n- Backend Development: Architecting resilient REST APIs and distributed microservices.\n- Commercial Impact: Demonstrable track record of driving business development and revenue growth.\n- SRE & Cloud: Maintaining high availability systems."
    );
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please upload your CV (PDF, DOCX, TXT, or MD format).");
      return;
    }
    if (!jobDesc.trim()) {
      setError("Please paste the target job description.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("cv_file", file);
    formData.append("job_description", jobDesc);

    try {
      const resp = await fetch("/api/match", {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || `Server error (${resp.status})`);
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to analyze semantic fit. Please ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // SVG Circular Meter Calculation
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animScore / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 pb-20">
      
      {/* Top Navigation Bar */}
      <nav className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white">Fitscore</span>
              <span className="hidden sm:inline ml-2.5 text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Semantic CV Matcher
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-750 hover:bg-slate-900/80 text-xs font-mono text-slate-300 transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved History</span>
              {history.length > 0 && (
                <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-extrabold text-slate-950 font-sans">
                  {history.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowVerification(!showVerification)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showVerification ? "Hide Spec Console" : "FastAPI Verification"}</span>
              {showVerification ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* User Authentication Status */}
            <div className="flex items-center gap-2 border-l border-slate-850 pl-3">
              {currentUser ? (
                <div className="flex items-center gap-3">
                  <span className="hidden md:inline-block text-xs font-mono text-slate-400 max-w-[180px] truncate" title={currentUser.email || ""}>
                    {currentUser.email}
                  </span>
                  <button
                    onClick={() => signOut(auth)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-900/30 hover:border-rose-900/50 hover:bg-rose-950/50 text-xs font-medium text-rose-400 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Log Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAuthModalMode("login");
                      setIsAuthModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 transition cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Log In</span>
                  </button>
                  <button
                    onClick={() => {
                      setAuthModalMode("signup");
                      setIsAuthModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign Up</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-10 space-y-12">
        
        {/* Execution Order & FastAPI Verification Panel */}
        {showVerification && (
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Backend Spec & Execution Order Audit
              </div>
              <span className="text-xs font-mono text-slate-400">Section 3 & Section 5 Compliant</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
              <div className="space-y-3">
                <span className="text-slate-300 font-semibold block">📐 FastAPI Architecture (/backend/main.py):</span>
                <p className="text-slate-400 leading-relaxed font-sans">
                  FastAPI server accepts <code className="text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded">POST /api/match</code> via <code className="text-emerald-300">multipart/form-data</code>. Uses <code className="text-emerald-300">pdfplumber</code> to extract text. Implements strict semantic equivalence prompt instructing Claude (`claude-sonnet-4-6`) to recognize conceptual synonyms (e.g. <em>"REST APIs" = "Backend development"</em>).
                </p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                  <span className="text-emerald-400 block mb-1">Local FastAPI Run Command:</span>
                  uvicorn main:app --reload --port 8000
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-slate-300 font-semibold block">🧪 Sample cURL Test Command:</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-emerald-300 overflow-x-auto leading-normal">
{`curl -X POST http://localhost:8000/api/match \\
  -H "Accept: application/json" \\
  -F "cv_file=@sample_cv.pdf;type=application/pdf" \\
  -F "job_description=Looking for a Senior Backend Lead with REST API experience and team leadership."`}
                </pre>
                <p className="text-slate-400 font-sans text-[11px]">
                  CORS enabled for <code className="text-slate-300">http://localhost:3000</code>. Output schema validated against Pydantic model contract with 1-shot retry guard.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hero Introduction */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
            Measure True Semantic Alignment Between CV & Job
          </h1>
          <p className="text-base sm:text-lg text-slate-400 font-normal leading-relaxed">
            Move beyond superficial keyword counting. Fitscore analyzes conceptual equivalence (e.g. <em className="text-emerald-400 not-italic font-medium">"Led a team" = "People management"</em>) to evaluate candidate suitability.
          </p>
        </div>

        {/* Input Form Section */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800/80">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span>Input Alignment Parameters</span>
            </h2>
            <button
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-emerald-400" />
              <span>⚡ Load Sample Senior Engineer CV & Job</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: CV Upload */}
              <div className="lg:col-span-5 space-y-3">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400">
                  1. Candidate Curriculum Vitae (PDF, DOCX, TXT, MD)
                </label>
                <label className="flex flex-col items-center justify-center w-full h-56 px-6 transition-all duration-200 bg-slate-950/80 border-2 border-slate-800 border-dashed rounded-2xl appearance-none cursor-pointer hover:border-emerald-500/50 group">
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 group-hover:bg-emerald-500/10 flex items-center justify-center transition">
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-200 truncate max-w-[280px]">
                        {file ? file.name : "Drag & drop file or browse"}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {file ? `${(file.size / 1024).toFixed(1)} KB ready` : "PDF, DOCX, TXT, MD • Max 10MB"}
                      </p>
                    </div>
                    {file && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </div>
                  <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {/* Right Column: Job Description */}
              <div className="lg:col-span-7 space-y-3">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400">
                  2. Target Job Description
                </label>
                <textarea
                  rows={8}
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  placeholder="Paste the full job description here (responsibilities, required skills, tone requirements)..."
                  className="w-full h-56 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed resize-none transition placeholder:text-slate-600"
                />
              </div>

            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-500/20 transition flex items-center justify-center gap-3 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Evaluating Semantic Fit with Fitscore AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 fill-slate-950" />
                  <span>Check my Fitscore</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Display Section */}
        {result && (
          <div id="results-panel" className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Award className="w-7 h-7 text-emerald-400" />
                <span>Semantic Alignment Assessment</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveToHistory}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <Bookmark className="w-4 h-4 fill-emerald-400/20" />
                  <span>{saveStatus || "Save to History"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setActiveHistoryId(null);
                  }}
                  className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> <span>Analyze Another Role</span>
                </button>
              </div>
            </div>

            {/* Score Overview: Circular Gauge & 4 Sub-score Gauges */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 sm:p-10">
              
              {/* Left: Animated Circular Score Meter */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center text-center">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Background Track */}
                    <circle
                      cx="96"
                      cy="96"
                      r={radius}
                      className="stroke-slate-800 fill-none"
                      strokeWidth="12"
                    />
                    {/* Animated Progress Track */}
                    <circle
                      cx="96"
                      cy="96"
                      r={radius}
                      className="stroke-emerald-400 fill-none transition-all duration-1000 ease-out drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white font-mono">
                      {animScore}%
                    </span>
                    <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 mt-1 font-semibold">
                      Fitscore
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 max-w-xs mt-4">
                  Overall conceptual match calculated from semantic equivalencies.
                </p>
              </div>

              {/* Right: Four Sub-scores */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { label: "Skills Alignment", val: result.breakdown.skills, icon: Briefcase, desc: "Conceptual overlap of required abilities" },
                  { label: "Experience Match", val: result.breakdown.experience, icon: Award, desc: "Functional leadership & scale fit" },
                  { label: "Qualifications", val: result.breakdown.qualifications, icon: BookOpen, desc: "Education & core credentials" },
                  { label: "Tone & Culture", val: result.breakdown.tone, icon: Sparkles, desc: "Communication style compatibility" }
                ].map((gauge, idx) => (
                  <div key={idx} className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <gauge.icon className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-slate-200">{gauge.label}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-emerald-400">{gauge.val}%</span>
                    </div>
                    {/* Gauge Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${gauge.val}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">{gauge.desc}</p>
                  </div>
                ))}
              </div>

            </div>

            {/* Skills Breakdown: Matched vs Missing Chips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Matched Skills */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-7 space-y-4">
                <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Matched Semantic Skills ({result.matched_skills.length})</span>
                </h3>
                <div className="flex flex-wrap gap-2.5 pt-2">
                  {result.matched_skills.map((skill: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shadow-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Missing Skills */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-7 space-y-4">
                <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  <span>Missing Requirements ({result.missing_skills.length})</span>
                </h3>
                <div className="flex flex-wrap gap-2.5 pt-2">
                  {result.missing_skills.map((skill: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-semibold shadow-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            {/* Rewrite Suggestions: Side-by-Side Cards */}
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <span>Actionable CV Bullet Rewrites ({result.rewrites.length})</span>
                </h3>
                <p className="text-sm text-slate-400">
                  Tailored side-by-side improvements to align your CV bullets with the semantic tone of the job description.
                </p>
              </div>

              <div className="space-y-6">
                {result.rewrites.map((rw: { original: string; improved: string }, idx: number) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-2 rounded-2xl border border-slate-800/80 bg-slate-900/30 overflow-hidden shadow-lg"
                  >
                    {/* Before Card */}
                    <div className="p-6 border-b md:border-b-0 md:border-r border-slate-800/80 bg-slate-950/40 flex flex-col justify-between space-y-4">
                      <div>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block mb-2">
                          Original CV Bullet
                        </span>
                        <p className="text-sm text-slate-400 leading-relaxed font-mono">
                          "{rw.original}"
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono italic">
                        Keyword/passive wording
                      </span>
                    </div>

                    {/* After Card */}
                    <div className="p-6 bg-emerald-950/20 flex flex-col justify-between space-y-4 relative group">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> Improved (Fitscore Tailored)
                          </span>
                          <button
                            onClick={() => copyText(rw.improved, idx)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-mono transition active:scale-95 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedIndex === idx ? "Copied!" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-sm text-emerald-100 font-medium leading-relaxed">
                          "{rw.improved}"
                        </p>
                      </div>
                      <span className="text-[10px] text-emerald-500/80 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Optimized for conceptual impact
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Slide-over Assessment History Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Overlay backdrop with fade effect */}
            <div 
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
              onClick={() => setIsHistoryOpen(false)}
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-md transform bg-[#0b0f19] border-l border-slate-800 shadow-2xl transition duration-300 ease-in-out">
                <div className="flex h-full flex-col overflow-y-scroll py-6">
                  
                  {/* Header */}
                  <div className="px-6 border-b border-slate-800/80 pb-5">
                    <div className="flex items-start justify-between">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2" id="slide-over-title">
                        <History className="w-5 h-5 text-emerald-400" />
                        <span>Saved Fitscore History</span>
                      </h2>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          className="rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 px-2 py-1 text-xs cursor-pointer"
                          onClick={() => setIsHistoryOpen(false)}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Quickly reload previously matched CVs and Job Descriptions.
                    </p>
                  </div>

                  {/* Body Content */}
                  <div className="relative mt-6 flex-1 px-6">
                    {history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-20 space-y-4">
                        <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
                          <Bookmark className="w-5 h-5 text-slate-600" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-300">No saved assessments</p>
                          <p className="text-xs text-slate-500 max-w-[240px]">
                            Run a matching evaluation and click "Save to History" to log it here.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs text-slate-500 pb-1">
                          <span>{history.length} assessment{history.length === 1 ? "" : "s"} found</span>
                          <button
                            onClick={() => {
                              if (window.confirm("Are you sure you want to clear your saved history? This cannot be undone.")) {
                                setHistory([]);
                                localStorage.removeItem("fitscore_history");
                                setActiveHistoryId(null);
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                          >
                            Clear All
                          </button>
                        </div>

                        <div className="space-y-3">
                          {history.map((item) => {
                            const isActive = activeHistoryId === item.id;
                            const isEditing = editingId === item.id;

                            return (
                              <div
                                key={item.id}
                                onClick={() => handleLoadHistoryItem(item)}
                                className={`group relative rounded-xl border p-4 text-left transition cursor-pointer ${
                                  isActive
                                    ? "bg-emerald-500/10 border-emerald-500/40 shadow-md shadow-emerald-500/5"
                                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/90"
                                }`}
                              >
                                <div className="space-y-2">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 flex-1 focus:outline-none focus:border-emerald-500"
                                        autoFocus
                                      />
                                      <button
                                        onClick={(e) => handleSaveRename(item.id, e)}
                                        className="p-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition line-clamp-1">
                                        {item.title}
                                      </h4>
                                      <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded shrink-0">
                                        {item.result.overall_score}% Match
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate max-w-[180px]">{item.fileName}</span>
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5 text-slate-600" />
                                      {item.timestamp.split(",")[0]}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {!isEditing && (
                                        <button
                                          onClick={(e) => handleStartRename(item.id, item.title, e)}
                                          className="text-slate-400 hover:text-slate-200 text-[10px] font-mono cursor-pointer"
                                        >
                                          Rename
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                                        className="text-rose-500 hover:text-rose-400 p-0.5 rounded hover:bg-rose-500/10 transition cursor-pointer"
                                        title="Delete Assessment"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />

    </div>
  );
}
