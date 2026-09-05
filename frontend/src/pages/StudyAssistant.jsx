import { useState } from "react";
import * as chatApi from "../api/chat";
import ChatWindow from "../components/ChatWindow";
import LoadingState from "../components/LoadingState";
import { Upload, BookOpen, Sparkles, Shield } from "lucide-react";

export default function StudyAssistant() {
  const [docId, setDocId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError("");
    try { const result = await chatApi.uploadDocument(file); setDocId(result.doc_id); }
    catch (err) { setError(err.response?.data?.detail || err.message || "Failed to upload"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-7 text-white shadow-xl">
        <img src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80&auto=format&fit=crop" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-overlay" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold tracking-widest uppercase border border-white/20"><Sparkles className="h-3.5 w-3.5" /> RAG · Grounded Answers</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Study Assistant</h1>
            <p className="mt-2 text-emerald-50 max-w-xl text-sm">Upload your own notes (PDF, DOCX, TXT) — answers come strictly from your material. Offline Phi-3-mini, no data leaves device. Chroma chunk 350/50.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white text-emerald-700 px-3 py-1 font-bold">✓ No hallucination</span>
              <span className="rounded-full bg-white/15 backdrop-blur text-white px-3 py-1 font-medium border border-white/20">Chroma + MiniLM</span>
              <span className="rounded-full bg-white/15 backdrop-blur text-white px-3 py-1 font-medium border border-white/20 flex items-center gap-1"><Shield className="h-3 w-3" /> Offline LLM</span>
            </div>
          </div>
          <img src="https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=320&q=80&auto=format&fit=crop" alt="Books" className="hidden lg:block h-28 w-40 object-cover rounded-2xl border-2 border-white/20 shadow-lg" />
        </div>
      </div>

      {!docId && !loading && (
        <div className="rounded-[20px] border-2 border-dashed border-slate-200 bg-white p-8 lg:p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
            <Upload className="h-8 w-8 text-white" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">Upload your notes</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Drop a PDF, DOCX or TXT — we chunk, embed and index it in Chroma so every answer is grounded in your excerpts.</p>
          <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700">
            <BookOpen className="h-4 w-4" /> Choose File
            <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileUpload} />
          </label>
          <p className="text-xs text-slate-400 mt-3">Supports PDF · DOCX · TXT · up to ~10k tokens per doc</p>
          {error && <p className="text-red-600 text-sm mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2 inline-block">{error}</p>}
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg mx-auto text-left">
            {[{t:"Chunking",d:"350 chars / 50 overlap"},{t:"Embeddings",d:"all-MiniLM-L6-v2 384d"},{t:"Retrieval",d:"Top-2 + grounded prompt"}].map(c=>(
              <div key={c.t} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-900">{c.t}</p><p className="text-xs text-slate-500 mt-1">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {loading && <div className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm"><LoadingState message="Ingesting document — chunking & embedding (may take a moment)…" /></div>}
      {docId && (
        <div className="rounded-[20px] border border-slate-200 bg-white p-2 shadow-sm">
          <div className="mb-2 flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest uppercase text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Chatting with your document</div>
          <ChatWindow selectedDocId={docId} />
        </div>
      )}
    </div>
  );
}
