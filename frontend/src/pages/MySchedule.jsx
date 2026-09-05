import { useEffect, useState, useMemo } from "react";
import { generateSchedule, detailedPlanToBlocks } from "../api/schedule";
import { getStudentDashboard } from "../api/predict";
import { getCachedErpMarks } from "../api/erp";
import ScheduleView from "../components/ScheduleView";
import LoadingState from "../components/LoadingState";

const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function MySchedule() {
  const [weakSubjects, setWeakSubjects] = useState([{ subject: "", score: "" }]);
  const [deadlines, setDeadlines] = useState([]);
  const [hours, setHours] = useState({ Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 });
  const [blocks, setBlocks] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("campusiq_user") || "null");
      if (u?.id) {
        const raw = localStorage.getItem(`schedule_cache_${u.id}`);
        if (raw) {
          const p = JSON.parse(raw);
          if (p?.blocks?.length) return p.blocks;
        }
      }
    } catch {}
    return [];
  });
  const [totalHours, setTotalHours] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("campusiq_user") || "null");
      if (u?.id) {
        const raw = localStorage.getItem(`schedule_cache_${u.id}`);
        if (raw) return JSON.parse(raw)?.totalHours || 0;
      }
    } catch {}
    return 0;
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasGenerated, setHasGenerated] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("campusiq_user") || "null");
      if (u?.id) return !!JSON.parse(localStorage.getItem(`schedule_cache_${u.id}`) || "null")?.blocks?.length;
    } catch {}
    return false;
  });
  const [predictorHint, setPredictorHint] = useState("");
  const [erpTest, setErpTest] = useState("");

  const erpTests = useMemo(() => {
    const c = getCachedErpMarks();
    if (!c?.subjects?.length) return [];
    return [...new Set(c.subjects.map((s) => s.test || "Unknown"))].sort();
  }, [hasGenerated]);

  // Compute weak subjects across ALL tests where any score <=60 — for Import <=60% button
  const weak60Count = useMemo(() => {
    const c = getCachedErpMarks();
    if (!c?.subjects?.length) return 0;
    // group by subject -> min percent across ASG-1/ASG-2/CT-1/CT-2
    const perSubject = {};
    for (const s of c.subjects) {
      if (!perSubject[s.subject] || s.percent < perSubject[s.subject]) perSubject[s.subject] = s.percent;
    }
    return Object.values(perSubject).filter((v) => v <= 60).length;
  }, [hasGenerated]);

  useEffect(() => {
    getStudentDashboard()
      .then((d) => {
        if (d?.hasData && d.topFactor) {
          setPredictorHint(`Predictor flag: ${d.topFactor} · risk ${d.academicRisk != null ? Math.round(d.academicRisk * 100) + "%" : ""}`);
        }
        const cached = getCachedErpMarks();
        if (cached?.subjects?.length) {
          if (cached.subjects[0]?.test) setErpTest(cached.subjects[0].test);
          if (weakSubjects.length === 1 && !weakSubjects[0].subject) {
            // Auto-import: only subjects <=60% across ASG-1/2/CT-1/2 first, else lowest 6
            const perSubject = {};
            for (const s of cached.subjects) {
              if (!perSubject[s.subject] || s.percent < perSubject[s.subject].percent) perSubject[s.subject] = s;
            }
            const weak60 = Object.values(perSubject).filter((s) => s.percent <= 60).sort((a, b) => a.percent - b.percent);
            const pool = weak60.length ? weak60 : [...cached.subjects].sort((a, b) => a.percent - b.percent).slice(0, 6);
            setWeakSubjects(pool.slice(0, 6).map((s) => ({ subject: s.subject, score: String(Math.round(s.percent)) })));
            const msg = weak60.length ? `ERP marks imported — ${weak60.length} weak (≤60%) subjects` : `ERP marks imported — ${pool.length} subjects (lowest ${Math.round(pool[0]?.percent || 0)}%)`;
            setPredictorHint((prev) => prev ? `${prev} · ${msg}` : msg);
          }
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
        const s = (w.subject || "").trim();
        if (!s) continue;
        const sc = Number(w.score);
        if (w.score === "" || Number.isNaN(sc) || sc < 0 || sc > 100) throw new Error(`Score for "${s || "subject"}" must be 0-100`);
        weak_map[s] = sc;
      }
      if (Object.keys(weak_map).length === 0) throw new Error("Add at least one subject with a valid score (0-100).");
      if (totalAvailable === 0) throw new Error("Set at least 1 available hour in your week.");

      const payload = {
        weak_subjects: weak_map,
        deadlines: deadlines
          .filter((d) => (d.subject || "").trim())
          .map((d) => ({ subject: d.subject.trim(), task: (d.task || "").trim() || "Assignment", days_until_due: Math.max(1, Math.min(365, Number(d.days_until_due) || 7)), is_important: !!d.is_important, kind: "todo" })),
        available_hours: Object.fromEntries(Object.entries(hours).map(([k, v]) => [k, Math.max(0, Math.min(6, Number(v) || 0))])),
      };
      const data = await generateSchedule(payload);
      const b = detailedPlanToBlocks(data.detailed_plan || {});
      setBlocks(b);
      setTotalHours(data.total_study_hours ?? totalAvailable);
      setHasGenerated(true);
      // persist for Dashboard preview (per-user) and for reload — reset tick progress for new plan
      try {
        const u = JSON.parse(localStorage.getItem("campusiq_user") || "null");
        if (u?.id) {
          localStorage.setItem(`schedule_cache_${u.id}`, JSON.stringify({ blocks: b, totalHours: data.total_study_hours ?? totalAvailable, at: new Date().toISOString(), detailed_plan: data.detailed_plan }));
          localStorage.setItem(`schedule_completed_${u.id}`, JSON.stringify({}));
          window.dispatchEvent(new Event("schedule-completed-updated"));
        }
      } catch {}
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Failed to generate schedule";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) return <LoadingState message="Loading your schedule…" />;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1280px]">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 p-7 text-white shadow-xl">
        <img src="https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=1200&q=80&auto=format&fit=crop" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-overlay" />
        <div className="relative">
          <p className="inline-flex rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold tracking-widest uppercase border border-white/20">Rule-based · 3-Tier Priority</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">My Schedule</h1>
          <p className="mt-2 text-violet-100 text-sm max-w-2xl">Priority: <span className="font-bold text-white">Important + near deadlines</span> → <span className="font-bold text-white">Regular todos</span> → <span className="font-bold text-amber-200">Marks ≤60%</span> — evening slots from 18:00, slack-aware.</p>
          {predictorHint && <p className="mt-3 inline-block rounded-full bg-white text-violet-700 px-3 py-1 text-xs font-bold">{predictorHint}</p>}
        </div>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-ink">Plan inputs — enter your real subjects & deadlines</h2>
          <button onClick={handleGenerate} disabled={loading} className="rounded-full bg-primary text-white px-5 py-2 text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors shrink-0">
            {loading ? "Generating…" : hasGenerated ? "Regenerate week" : "Generate my week"}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Your subjects & current scores (0-100) — ≤60% get top marks priority</h3>
            <div className="flex items-center gap-2">
              {erpTests.length > 0 && (
                <select value={erpTest} onChange={(e) => setErpTest(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs">
                  {erpTests.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <button onClick={() => {
                const cached = getCachedErpMarks();
                if (!cached?.subjects?.length) return;
                // Import ≤60% across ALL tests (ASG-1/2/CT-1/2) — group by subject min
                const perSubject = {};
                for (const s of cached.subjects) {
                  if (!perSubject[s.subject] || s.percent < perSubject[s.subject].percent) perSubject[s.subject] = s;
                }
                const weak60 = Object.values(perSubject).filter((s) => s.percent <= 60).sort((a, b) => a.percent - b.percent);
                if (weak60.length) {
                  setWeakSubjects(weak60.slice(0, 8).map((s) => ({ subject: s.subject, score: String(Math.round(s.percent)) })));
                  return;
                }
                let pool = cached.subjects;
                if (erpTest) pool = pool.filter((s) => (s.test || "Unknown") === erpTest);
                const sorted = [...pool].sort((a, b) => a.percent - b.percent).slice(0, 6);
                if (!sorted.length) return;
                setWeakSubjects(sorted.map((s) => ({ subject: s.subject, score: String(Math.round(s.percent)) })));
              }} className="text-xs font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline" disabled={!getCachedErpMarks()?.subjects?.length} title="Import subjects ≤60% across ASG-1/2/CT-1/2, else lowest from selected test">↻ Import ≤60% {weak60Count ? `(${weak60Count} weak)` : erpTest ? `from ${erpTest}` : "from ERP"}</button>
              <button onClick={() => setWeakSubjects([...weakSubjects, { subject: "", score: "" }])} className="text-xs font-semibold text-primary hover:underline">+ Add subject</button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {weakSubjects.map((w, i) => (
              <div key={i} className={`flex gap-2 items-center rounded-xl border px-3 py-2 ${Number(w.score) <= 60 && w.score !== "" ? "border-amber-300 bg-amber-50" : "border-border bg-surface"}`}>
                <input value={w.subject} onChange={(e) => setWeakSubjects(weakSubjects.map((x, idx) => idx === i ? { ...x, subject: e.target.value } : x))} placeholder="Subject (e.g. BCS-501)" className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-muted/40" />
                <input type="number" min={0} max={100} placeholder="—" value={w.score} onChange={(e) => setWeakSubjects(weakSubjects.map((x, idx) => idx === i ? { ...x, score: e.target.value } : x))} className="w-16 rounded-lg border border-border bg-white px-2 py-1 text-sm text-center outline-none focus:border-primary" />
                <button onClick={() => setWeakSubjects(weakSubjects.length === 1 ? [{ subject: "", score: "" }] : weakSubjects.filter((_, idx) => idx !== i))} className="text-ink-muted hover:text-risk-high text-sm px-1">×</button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted mt-1.5">Amber = ≤60% (ASG/CT weak) → prioritized in Tier 3 after your todos. Lower score = higher priority within tier.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Your todos & deadlines — ★ Important + nearest first</h3>
            <button onClick={() => setDeadlines([...deadlines, { subject: "", task: "", days_until_due: 3, is_important: false }])} className="text-xs font-semibold text-primary hover:underline">+ Add todo</button>
          </div>
          {deadlines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-ink-muted italic">No todos yet — add important tasks to rank Tier 1, regular tasks Tier 2. Marks (≤60%) fill remaining slots.</p>
              <button onClick={() => setDeadlines([{ subject: "", task: "", days_until_due: 3, is_important: true }])} className="text-xs font-semibold text-primary hover:underline shrink-0 ml-4">Add first todo</button>
            </div>
          ) : (
            <div className="space-y-2">
              {deadlines.map((d, i) => (
                <div key={i} className={`grid grid-cols-12 gap-2 items-center rounded-xl px-2 py-1 ${d.is_important ? "bg-purple-50 border border-purple-200" : "bg-transparent"}`}>
                  <label className="col-span-1 flex items-center justify-center gap-1 text-xs" title="Mark as most important — Tier 1 priority">
                    <input type="checkbox" checked={!!d.is_important} onChange={(e) => setDeadlines(deadlines.map((x, idx) => idx === i ? { ...x, is_important: e.target.checked } : x))} className="rounded" />
                    <span className={d.is_important ? "text-purple-700 font-bold" : "text-ink-muted"}>★</span>
                  </label>
                  <input value={d.subject} onChange={(e) => setDeadlines(deadlines.map((x, idx) => idx === i ? { ...x, subject: e.target.value } : x))} placeholder="Subject" className="col-span-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input value={d.task} onChange={(e) => setDeadlines(deadlines.map((x, idx) => idx === i ? { ...x, task: e.target.value } : x))} placeholder="Task (e.g. BCS-501 notes revision)" className="col-span-4 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <label className="col-span-3 flex items-center gap-1.5 text-xs text-ink-muted">
                    <input type="number" min={1} max={365} value={d.days_until_due} onChange={(e) => setDeadlines(deadlines.map((x, idx) => idx === i ? { ...x, days_until_due: e.target.value } : x))} className="w-14 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-center outline-none focus:border-primary" />
                    days left
                  </label>
                  <button onClick={() => setDeadlines(deadlines.filter((_, idx) => idx !== i))} className="col-span-1 text-ink-muted hover:text-risk-high">×</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-ink-muted mt-1.5">★ Important or ≤3 days = Tier 1 (purple) → regular todos Tier 2 (sky) → weak subjects ≤60% Tier 3 (amber).</p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-2">Your available hours per day (evening slots from 18:00)</h3>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {DAYS_FULL.map((day) => (
              <label key={day} className="rounded-xl border border-border bg-surface px-2 py-2 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">{day.slice(0, 3)}</span>
                <input type="number" min={0} max={6} value={hours[day]} onChange={(e) => setHours({ ...hours, [day]: e.target.value })} className="mt-1 w-12 rounded-lg border border-border bg-surface-elevated px-1 py-1 text-sm text-center outline-none focus:border-primary mx-auto block" />
                <span className="text-[10px] text-ink-muted">hours</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-ink-muted mt-2">{totalAvailable}h available this week {totalAvailable === 0 ? "· set at least 1h to generate" : totalAvailable > 12 ? "· consider capping at 12h to avoid burnout" : ""}</p>
        </div>

        {error && <p className="text-sm text-risk-high bg-risk-high-bg border border-risk-high/20 rounded-xl px-3 py-2">{error}</p>}
      </div>

      {loading ? <LoadingState message="Building your week… (Tier 1 important → Tier 2 todos → Tier 3 marks ≤60%)" /> : hasGenerated ? <ScheduleView blocks={blocks} totalHours={totalHours} /> : (
        <div className="rounded-2xl border border-dashed border-border bg-surface-elevated px-8 py-12 text-center">
          <p className="text-sm font-medium text-ink">No schedule generated yet</p>
          <p className="text-xs text-ink-muted mt-1 max-w-lg mx-auto">Add your todos (★ important first) and import ≤60% weak subjects, set hours, then Generate. Tier 1 todos get earliest evening slots.</p>
        </div>
      )}
    </div>
  );
}
