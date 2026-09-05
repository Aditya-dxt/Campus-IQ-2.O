import { useEffect, useState } from "react";
import * as resumeApi from "../api/resume";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import ResumeUploader from "../components/ResumeUploader";

export default function ResumeScanner() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    resumeApi.getResumeHistory().then(setHistory).catch(()=>{}).finally(()=>setHistoryLoading(false));
  }, []);

  const handleAnalyze = async ({ file, jobDescription }) => {
    setLoading(true); setResult(null);
    try { const data = await resumeApi.analyzeResume({ file, jobDescription }); setResult(data); }
    catch (err) { setResult({ error: err.response?.data?.detail || err.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with image */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-800 p-7 text-white shadow-xl">
        <img src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&q=80&auto=format&fit=crop" alt="" className="absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-luminosity" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="inline-flex rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold tracking-widest uppercase border border-white/20">ATS · Semantic Match</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Resume Scanner</h1>
            <p className="mt-2 text-indigo-100 max-w-xl text-sm">Upload your resume and paste a job description — get an ATS match score, missing keywords and tailored suggestions powered by sentence-transformers.</p>
          </div>
          <img src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=320&q=80&auto=format&fit=crop" alt="Resume" className="hidden lg:block h-28 w-40 object-cover rounded-2xl border-2 border-white/20 shadow-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Analyze your resume</h2>
          <p className="text-xs text-slate-500 mb-4">PDF or DOCX · embeddings: all-MiniLM-L6-v2 (384d) · cosine similarity</p>
          <ResumeUploader onAnalyze={handleAnalyze} loading={loading} />
        </div>

        <div className="space-y-4">
          {loading && <div className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm"><LoadingState message="Analyzing — extracting keywords with spaCy, computing embeddings…" /></div>}
          {!loading && !result && (
            <div className="rounded-[20px] border-2 border-dashed border-slate-200 bg-white p-8 text-center">
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&q=80&auto=format&fit=crop" alt="" className="h-20 w-20 rounded-2xl object-cover mx-auto mb-4" />
              <p className="font-bold text-slate-900">Results will appear here</p>
              <p className="text-sm text-slate-500 mt-1">Run an analysis to see your match score, missing keywords and suggested edits.</p>
            </div>
          )}
          {result && result.error && (
            <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-red-700"><p className="font-bold">Analysis failed</p><p className="text-sm mt-1">{result.error}</p></div>
          )}
          {result && !result.error && (
            <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm space-y-6 animate-fade-in">
              <div className="text-center py-2">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-400">Match score</p>
                <div className="mt-2 inline-flex items-baseline gap-1">
                  <span className="text-6xl font-extrabold bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-transparent">{result.score}</span>
                  <span className="text-slate-400 font-bold">/100</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600" style={{width: `${result.score}%`}} />
                </div>
                <p className="text-xs text-slate-500 mt-2">{result.score >= 75 ? "Excellent — close to ATS-ready" : result.score >= 50 ? "Good — few gaps to fix" : "Needs work — add missing keywords"}</p>
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-3">Missing keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {result.missing_keywords?.length ? result.missing_keywords.map(kw=>(
                    <span key={kw} className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-semibold">{kw}</span>
                  )) : <span className="text-xs text-emerald-600 font-medium">✓ No major gaps detected</span>}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-3">Suggested edits</h3>
                <ul className="space-y-2">
                  {result.suggestions?.map((s,i)=>(
                    <li key={i} className="flex gap-2 text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">{i+1}</span>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Past scans</h2>
          <span className="text-xs text-slate-400">{history.length} total</span>
        </div>
        {historyLoading ? <LoadingState message="Loading history…" /> : history.length===0 ? (
          <div className="text-center py-8"><p className="text-sm font-medium text-slate-500">No past scans yet</p><p className="text-xs text-slate-400">Your analysis history will appear here.</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {history.map(h=>(
              <div key={h.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex justify-between items-center hover:bg-white hover:shadow-sm transition-all">
                <div><p className="text-sm font-semibold text-slate-900">{h.jobTitle || "Job scan"}</p><p className="text-xs text-slate-500">{h.createdAt || ""}</p></div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm font-bold shadow">{h.score}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
