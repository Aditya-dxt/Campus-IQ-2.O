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
    resumeApi
      .getResumeHistory()
      .then(setHistory)
      .catch((err) => console.error("Failed to load history:", err))
      .finally(() => setHistoryLoading(false));
  }, []);

  const handleAnalyze = async ({ jobDescription }) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await resumeApi.analyzeResume({ jobDescription });
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Resume Scanner</h1>
        <p className="text-sm text-ink-muted mt-1">
          Upload your resume and paste a job description to see how well you align.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-border bg-surface-elevated p-6">
          <ResumeUploader onAnalyze={handleAnalyze} loading={loading} />
        </div>

        <div className="space-y-6">
          {loading && <LoadingState message="Analyzing your resume…" />}

          {!loading && !result && (
            <EmptyState
              title="Results will appear here"
              description="Run an analysis to see your match score, missing keywords, and suggested edits."
            />
          )}

          {result && result.error && (
            <div className="rounded-2xl border border-risk-high/30 bg-risk-high-bg p-6 text-risk-high">
              <p className="font-medium">Analysis failed</p>
              <p className="text-sm mt-1">{result.error}</p>
            </div>
          )}

          {result && !result.error && (
            <div className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-6 animate-fade-in">
              <div className="text-center py-4">
                <p className="text-sm text-ink-muted">Match score</p>
                <p className="text-5xl font-semibold text-primary">{result.score}</p>
                <p className="text-xs text-ink-muted mt-1">out of 100</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-ink mb-3">Missing keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {result.missing_keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-risk-mid-bg text-risk-mid px-3 py-1 text-xs font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-ink mb-3">Suggested edits</h3>
                <ul className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm text-ink-muted leading-relaxed"
                    >
                      <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-base font-medium text-ink mb-4">Past scans</h2>
        {historyLoading ? (
          <LoadingState message="Loading history…" />
        ) : history.length === 0 ? (
          <EmptyState title="No past scans" description="Your analysis history will show up here." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {history.map((h) => (
              <div
                key={h.id}
                className="rounded-xl border border-border bg-surface-elevated px-4 py-3 flex justify-between items-center"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{h.jobTitle}</p>
                  <p className="text-xs text-ink-muted">{h.createdAt}</p>
                </div>
                <span className="text-lg font-semibold text-primary">{h.score}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
