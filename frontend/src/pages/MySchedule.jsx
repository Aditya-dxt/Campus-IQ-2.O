import { useEffect, useState } from "react";
import { generateSchedule, detailedPlanToBlocks } from "../api/schedule";
import { getStudentDashboard } from "../api/predict";
import ScheduleView from "../components/ScheduleView";
import LoadingState from "../components/LoadingState";

const DEFAULT_WEAK = [
  { subject: "Data Structures", score: 45 },
  { subject: "Algorithms", score: 60 },
  { subject: "DBMS", score: 72 },
];
const DEFAULT_DEADLINES = [
  { subject: "Data Structures", task: "Midterm", days_until_due: 3 },
  { subject: "DBMS", task: "Lab Viva", days_until_due: 2 },
];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DEFAULT_HOURS = { Monday: 2, Tuesday: 2, Wednesday: 2, Thursday: 2, Friday: 1, Saturday: 0, Sunday: 0 };

export default function MySchedule() {
  const [weakSubjects, setWeakSubjects] = useState(DEFAULT_WEAK);
  const [deadlines, setDeadlines] = useState(DEFAULT_DEADLINES);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [blocks, setBlocks] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [predictorHint, setPredictorHint] = useState("");

  // Prefill weak subjects from predictor if available
  useEffect(() => {
    getStudentDashboard()
      .then((d) => {
        if (d?.hasData && d.topFactor) {
          // topFactor like "attendance_pct" -> hint, keep defaults but show banner
          setPredictorHint(`Predictor flag: ${d.topFactor} · risk ${d.academicRisk != null ? Math.round(d.academicRisk * 100) + "%" : ""}`);
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  const totalAvailable = Object.values(hours).reduce((a, b) => a + (Number(b) || 0), 0);

  async function handleGenerate() {
    setError("");
    setLoading(true);
    try {
      const weak_map = {};
      for (const w of weakSubjects) {
        const s = w.subject.trim();
        if (!s) continue;
        const sc = Number(w.score);
        if (Number.isNaN(sc) || sc < 0 || sc > 100) throw new Error(`Score for "${s}" must be 0-100`);
        weak_map[s] = sc;
      }
      if (Object.keys(weak_map).length === 0) throw new Error("Add at least one subject with a score.");
      if (totalAvailable === 0) throw new Error("Set at least 1 available hour in your week.");

      const payload = {
        weak_subjects: weak_map,
        deadlines: deadlines
          .filter((d) => d.subject.trim())
          .map((d) => ({ subject: d.subject.trim(), task: d.task.trim() || "Assignment", days_until_due: Math.max(1, Math.min(365, Number(d.days_until_due) || 7)) })),
        available_hours: Object.fromEntries(Object.entries(hours).map(([k, v]) => [k, Math.max(0, Math.min(6, Number(v) || 0))])),
      };
      const data = await generateSchedule(payload);
      const b = detailedPlanToBlocks(data.detailed_plan || {});
      setBlocks(b);
      setTotalHours(data.total_study_hours ?? totalAvailable);
      setHasGenerated(true);
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Failed to generate schedule";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  // Auto-generate on first load so screenshot never shows empty "Free" week
  useEffect(() => {
    if (!initialLoading && !hasGenerated) handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoading]);

  if (initialLoading) return <LoadingState message="Loading your schedule…" />;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1280px]">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My Schedule</h1>
        <p className="text-sm text-ink-muted mt-1">Your personalized week — each block shows <span className="font-medium text-ink">why</span> it’s on your plan (weak score · deadline urgency).</p>
        {predictorHint && <p className="text-xs mt-2 inline-block bg-risk-mid-bg text-risk-mid px-2.5 py-1 rounded-full font-medium">{predictorHint}</p>}
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-border bg-surface-elevated p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Plan inputs</h2>
          <button onClick={handleGenerate} disabled={loading} className="rounded-full bg-primary text-white px-5 py-2 text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors">
            {loading ? "Generating…" : hasGenerated ? "Regenerate week" : "Generate my week"}
          </button>
        </div>

        {/* Weak subjects */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Weak subjects & scores (0-100)</h3>
            <button onClick={() => setWeakSubjects([...weakSubjects, { subject: "", score: 70 }])} className="text-xs font-semibold text-primary hover:underline">+ Add subject</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {weakSubjects.map((w, i) => (
              <div key={i} className="flex gap-2 items-center rounded-xl border border-border bg-surface px-3 py-2">
                <input value={w.subject} onChange={(e) => setWeakSubjects(weakSubjects.map((x, idx) => idx === i ? { ...x, subject: e.target.value } : x))} placeholder="Subject (e.g. OS)" className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-muted/40" />
                <input type="number" min={0} max={100} value={w.score} onChange={(e) => setWeakSubjects(weakSubjects.map((x, idx) => idx === i ? { ...x, score: e.target.value } : x))} className="w-16 rounded-lg border border-border bg-surface-elevated px-2 py-1 text-sm text-center outline-none focus:border-primary" />
                <button onClick={() => setWeakSubjects(weakSubjects.filter((_, idx) => idx !== i))} className="text-ink-muted hover:text-risk-high text-sm px-1">×</button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted mt-1.5">Lower score = higher priority. Linked to Predictor’s SHAP top-factor.</p>
        </div>

        {/* Deadlines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Upcoming deadlines</h3>
            <button onClick={() => setDeadlines([...deadlines, { subject: "", task: "", days_until_due: 7 }])} className="text-xs font-semibold text-primary hover:underline">+ Add deadline</button>
          </div>
          {deadlines.length === 0 ? (
            <p className="text-xs text-ink-muted italic">No deadlines — schedule will balance purely by weak scores.</p>
          ) : (
            <div className="space-y-2">
              {deadlines.map((d, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={d.subject} onChange={(e) => setDeadlines(deadlines.map((x, idx) => idx === i ? { ...x, subject: e.target.value } : x))} placeholder="Subject" className="col-span-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input value={d.task} onChange={(e) => setDeadlines(deadlines.map((x, idx) => idx === i ? { ...x, task: e.target.value } : x))} placeholder="Task (Midterm, Assignment 4)" className="col-span-5 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <label className="col-span-3 flex items-center gap-1.5 text-xs text-ink-muted">
                    <input type="number" min={1} max={365} value={d.days_until_due} onChange={(e) => setDeadlines(deadlines.map((x, idx) => idx === i ? { ...x, days_until_due: e.target.value } : x))} className="w-14 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-center outline-none focus:border-primary" />
                    days left
                  </label>
                  <button onClick={() => setDeadlines(deadlines.filter((_, idx) => idx !== i))} className="col-span-1 text-ink-muted hover:text-risk-high">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available hours */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-2">Available hours per day (evening slots from 18:00)</h3>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {DAYS_FULL.map((day) => (
              <label key={day} className="rounded-xl border border-border bg-surface px-2 py-2 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">{day.slice(0, 3)}</span>
                <input type="number" min={0} max={6} value={hours[day]} onChange={(e) => setHours({ ...hours, [day]: e.target.value })} className="mt-1 w-12 rounded-lg border border-border bg-surface-elevated px-1 py-1 text-sm text-center outline-none focus:border-primary mx-auto block" />
                <span className="text-[10px] text-ink-muted">hours</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-ink-muted mt-2">{totalAvailable}h available this week {totalAvailable > 12 ? "· consider capping at 12h to avoid burnout" : ""}</p>
        </div>

        {error && <p className="text-sm text-risk-high bg-risk-high-bg border border-risk-high/20 rounded-xl px-3 py-2">{error}</p>}
      </div>

      {/* Result grid */}
      {loading ? <LoadingState message="Building your week…" /> : <ScheduleView blocks={blocks} totalHours={hasGenerated ? totalHours : undefined} />}
    </div>
  );
}
