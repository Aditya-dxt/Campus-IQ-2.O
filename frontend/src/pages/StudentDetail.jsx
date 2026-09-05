import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import * as interventionApi from "../api/intervention";
import * as predictApi from "../api/predict";
import InterventionLog from "../components/InterventionLog";
import LoadingState from "../components/LoadingState";
import { formatPercent, readinessLabel, riskBadgeClass, riskLabel } from "../utils/risk";

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ action: "", actionNote: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([predictApi.getStudentById(id), interventionApi.getInterventions(id), interventionApi.getInterventionActions()])
      .then(([s, ints, acts]) => { setStudent(s); setInterventions(ints); setActions(acts); setForm((f) => ({ ...f, action: acts[0]?.id || "" })); })
      .catch((err) => console.error("Failed to load student data:", err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.actionNote.trim()) return;
    setSubmitting(true); setMsg("");
    try {
      const entry = await interventionApi.createIntervention({ studentId: id, action: form.action, actionNote: form.actionNote, riskBefore: student.academicRisk });
      setInterventions((prev) => [entry, ...prev]);
      setForm((f) => ({ ...f, actionNote: "" }));
      setMsg(`Logged — risk_before ${entry.riskBefore!=null? (entry.riskBefore*100).toFixed(1)+"%":"pending"}. Re-evaluate after review date.`);
    } catch (err) {
      setMsg(err.response?.data?.detail || err.message);
    } finally { setSubmitting(false); }
  };

  const handleReview = async (interventionId) => {
    setMsg("");
    try {
      const res = await interventionApi.reviewIntervention(interventionId);
      setInterventions(prev => prev.map(p => p.id===interventionId ? { ...p, riskAfter: res.risk_after } : p));
      setMsg(res.message || `Reviewed — delta ${res.delta}`);
    } catch (err) {
      setMsg(err.response?.data?.detail || err.message);
    }
  };

  if (loading) return <LoadingState message="Loading student profile…" />;
  if (!student) return <p className="text-red-600 text-sm">Student not found.</p>;

  const reviewDate = new Date(); reviewDate.setDate(reviewDate.getDate() + 14);

  const breakdown = student.breakdown;
  const hasBreakdown = !!breakdown;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/mentor" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" /> Back to cohort</Link>

      <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="absolute right-0 top-0 h-32 w-32 opacity-5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-bl-[64px]" />
        <div className="flex flex-wrap items-start justify-between gap-4 relative">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{student.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{student.branch} · {student.year} · GPA {student.gpa} · {student.section || ""}</p>
            <p className="text-xs text-slate-400 mt-0.5">{student.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold border ${riskBadgeClass(student.academicRisk)}`}>Risk {formatPercent(student.academicRisk)} · {riskLabel(student.academicRisk)}</span>
            <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 text-xs font-bold">Placement {formatPercent(student.placementReadiness)} · {readinessLabel(student.placementReadiness)}</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600"><span className="font-bold text-slate-900">Top factor:</span> {student.topFactor || "—"}</p>
        <p className="mt-1 text-sm text-slate-600"><span className="font-bold text-slate-900">Resume score:</span> {student.resumeScore ?? "—"}/100</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-medium text-violet-700"><Sparkles className="h-3.5 w-3.5" /> Closed-loop: log → snapshot risk_before → re-evaluate at review → delta</div>
      </div>

      {/* SHAP Explainability — PPT 10/10 */}
      {hasBreakdown && (
        <div className="rounded-[20px] border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h2 className="text-sm font-bold tracking-widest uppercase text-slate-700 flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /> Explainability — why this risk?</h2>
            <span className="text-xs font-mono text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">{breakdown.formula}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { key: "attendance", label: "Attendance", pct: breakdown.attendance_pct, weight: breakdown.weights.attendance, color: "bg-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
              { key: "marks", label: "Marks (CGPA base)", pct: breakdown.marks_pct, weight: breakdown.weights.marks, color: "bg-violet-500", bg: "bg-violet-50", border: "border-violet-200" },
              { key: "resume", label: "Resume", pct: breakdown.has_resume ? breakdown.resume_pct : 0, weight: breakdown.weights.resume, color: "bg-cyan-500", bg: "bg-cyan-50", border: "border-cyan-200", missing: !breakdown.has_resume },
            ].map((f) => (
              <div key={f.key} className={`rounded-2xl border ${f.border} ${f.bg} p-4`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-500">{f.label}</p>
                  <span className="text-xs font-bold text-slate-600">{Math.round(f.weight * 100)}% weight</span>
                </div>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">{f.missing ? "—" : `${f.pct}%`}<span className="text-xs font-normal text-slate-500">{f.missing ? " (no resume yet)" : ""}</span></p>
                <div className="mt-3 h-2.5 w-full rounded-full bg-white border border-slate-200 overflow-hidden">
                  <div className={`h-full rounded-full ${f.color} transition-all duration-700`} style={{ width: `${f.missing ? 0 : f.pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Contributes <span className="font-bold text-slate-700">{f.missing ? "0.0000" : (breakdown.contributions[f.key] ?? 0).toFixed(4)}</span> to placement</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600">Placement {formatPercent(student.placementReadiness)} · 0.40·marks + 0.30·attendance + 0.30·resume</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600">Risk = 1 − placement = {formatPercent(student.academicRisk)}</span>
            <span className="text-xs text-slate-400">Weakest link → <span className="font-bold text-slate-700">{student.topFactor}</span></span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">SHAP-style: smallest pct drives risk. Improve the lowest bar first — mentor can target that factor.</p>
        </div>
      )}

      {msg && <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-4">Intervention history</h2>
          <InterventionLog interventions={interventions} onReview={handleReview} />
          <p className="text-xs text-slate-400 mt-3">Tip: Click Re-evaluate now to simulate the 14-day review and see risk delta instantly for demo.</p>
        </section>

        <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm h-fit">
          <h2 className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-1">Log new intervention</h2>
          <p className="text-xs text-slate-500 mb-4">Mentor action is snapshot with current risk_before; risk_after fills at review.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Action</label>
              <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                {actions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
              <textarea rows={4} required value={form.actionNote} onChange={(e) => setForm((f) => ({ ...f, actionNote: e.target.value }))} placeholder="e.g. Assigned tutoring for BCS-501, weekly check-ins, focus on attendance..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y" />
            </div>
            <p className="text-xs text-slate-500">Auto review date: <span className="font-bold text-slate-900">{reviewDate.toLocaleDateString()}</span> (14 days) — you can also Re-evaluate now for demo.</p>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Log intervention
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
