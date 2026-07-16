import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

export default function ResumeUploader({ onAnalyze, loading }) {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAnalyze({ file, jobDescription });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink mb-2">Resume file</label>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-elevated px-6 py-10 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <FileUp className="h-8 w-8 text-primary" strokeWidth={1.5} />
          <p className="text-sm text-ink-muted">
            {file ? file.name : "Click to upload PDF or DOCX"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="job-desc" className="block text-sm font-medium text-ink mb-2">
          Job description
        </label>
        <textarea
          id="job-desc"
          rows={6}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description here to compare against your resume…"
          className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !jobDescription.trim()}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Analyze resume
      </button>
    </form>
  );
}
