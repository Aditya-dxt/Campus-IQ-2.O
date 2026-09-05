import { useEffect, useState } from "react";
import { Clock, FileText, GraduationCap, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import * as interventionApi from "../api/intervention";
import { useAuth } from "../context/AuthContext";
import LoadingState from "../components/LoadingState";
import { formatPercent, riskLabel } from "../utils/risk";

function statusTone(it) {
  if (it.riskAfter != null) return it.riskAfter < it.riskBefore ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
}

export default function StudentInterventions() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    interventionApi.getInterventions(user.id).then(setItems).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <LoadingState message="Loading your mentor feedback…" />;
  if (err) return <p className="text-sm text-red-600">{err}</p>;

  return (
    <div className="space-y-6 animate-fade-in max-w-[900px] mx-auto">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 p-7 text-white shadow-xl">
        <div className="relative">
          <p className="inline-flex rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold tracking-widest uppercase border border-white/20"><Sparkles className="h-3.5 w-3.5 mr-1 inline" /> Mentor Feedback</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">My interventions</h1>
          <p className="mt-2 text-indigo-100 text-sm max-w-xl">Your mentor's actions for you — what to fix, by when, and how risk is tracked before → after. Risk = 1 − placement (marks 40% + attendance 30% + resume 30%).</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-900">No feedback yet</p>
          <p className="text-sm text-slate-500 mt-1">When your mentor logs an intervention, it will appear here with the gap to close and review date.</p>
          <Link to="/resume" className="mt-4 inline-flex rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-bold hover:bg-black">Scan resume to improve placement</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => {
            const reviewed = it.riskAfter != null;
            const delta = reviewed && it.riskBefore != null ? Number((it.riskAfter - it.riskBefore).toFixed(4)) : null;
            const improved = delta != null && delta < 0;
            return (
              <article key={it.id} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm hover:shadow transition-shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusTone(it)}`}>
                      <GraduationCap className="h-3.5 w-3.5" /> {it.action}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" /> {new Date(it.createdAt).toLocaleDateString()} → Review {it.reviewDate ? new Date(it.reviewDate).toLocaleDateString() : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="rounded-lg bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 font-bold">{it.riskBefore != null ? formatPercent(it.riskBefore) : "—"} before</span>
                    <span className="text-slate-400">→</span>
                    {reviewed ? (
                      <span className={`rounded-lg px-2 py-1 font-bold border ${improved ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>{formatPercent(it.riskAfter)} after</span>
                    ) : (
                      <span className="rounded-lg bg-slate-100 text-slate-500 border border-slate-200 px-2 py-1 font-medium">Pending review {it.reviewDate ? `(${new Date(it.reviewDate).toLocaleDateString()})` : ""}</span>
                    )}
                    {delta != null && (
                      <span className={`rounded-lg px-2 py-1 font-bold text-xs ${improved ? "bg-emerald-600 text-white" : delta > 0 ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700"}`}>{delta > 0 ? "+" : ""}{formatPercent(Math.abs(delta))} {improved ? "↓ improved" : delta > 0 ? "↑" : ""}</span>
                    )}
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400 flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> What to fix</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{it.actionNote}</p>
                </div>
                {!reviewed && (
                  <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 flex items-start gap-2">
                    <FileText className="h-4 w-4 text-indigo-600 mt-0.5" />
                    <div className="text-xs leading-relaxed text-indigo-900">
                      <span className="font-bold">How to close the gap:</span> {it.actionNote.toLowerCase().includes("resume") ? "Scan your updated resume at Resume Scanner — add keywords from the job description, fix formatting, then risk/placement will recalc (40% marks + 30% attendance + 30% resume)." : "Follow the note above, then update the artifact (resume/schedule/marks) so placement improves and risk drops."} <Link to="/resume" className="font-bold underline">Go to Resume Scanner →</Link>
                    </div>
                  </div>
                )}
                {reviewed && (
                  <p className="mt-2 text-xs text-slate-500">Reviewed — {improved ? "risk dropped, keep the improvement" : "risk rose — discuss with mentor"}. Risk is 1 − placement (marks 40% + attendance 30% + resume 30%).</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
