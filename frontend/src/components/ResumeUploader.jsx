import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles, Upload, Target } from "lucide-react";

export default function ResumeUploader({ onAnalyze, loading }) {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const inputRef = useRef(null);

  const handleSubmit = (e) => { e.preventDefault(); onAnalyze({ file, jobDescription }); };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">Resume file</label>
        <div role="button" tabIndex={0} onClick={()=>inputRef.current?.click()} onKeyDown={e=>e.key==="Enter"&&inputRef.current?.click()}
          className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm group-hover:border-indigo-200">
            <FileUp className="h-6 w-6 text-indigo-600" strokeWidth={1.75} />
          </span>
          <p className="text-sm font-medium text-slate-700">{file ? <span className="text-indigo-600 font-bold">{file.name}</span> : "Click to upload PDF or DOCX"}</p>
          <p className="text-xs text-slate-400">Drag & drop or click to browse</p>
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e=>setFile(e.target.files?.[0]||null)} />
        </div>
      </div>
      <div>
        <label htmlFor="job-desc" className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">Job description</label>
        <textarea id="job-desc" rows={6} value={jobDescription} onChange={e=>setJobDescription(e.target.value)} placeholder="Paste the job description here — we extract keywords with spaCy and match via cosine similarity…" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y" />
        <p className="text-xs text-slate-400 mt-1.5">Tip: include must-have skills (e.g. React, SQL, DSA) for better keyword gap.</p>
      </div>
      <button type="submit" disabled={loading || !jobDescription.trim() || !file} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</> : <><Target className="h-4 w-4" /> Analyze resume</>}
      </button>
    </form>
  );
}
