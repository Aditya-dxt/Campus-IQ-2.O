import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as predictApi from "../api/predict";
import LoadingState from "../components/LoadingState";
import RiskTable from "../components/RiskTable";
import { useAuth } from "../context/AuthContext";

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <div className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[36px] opacity-[0.08] ${accent || "bg-indigo-500"}`} />
      <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">{label}</p>
      <p className="text-3xl font-extrabold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [cohort, setCohort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([predictApi.getStudents(), predictApi.getCohortStats()])
      .then(([s, c]) => {
        setStudents(s);
        setCohort(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading cohort data…" />;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const sectionLabel = user?.coordinator_section || user?.branch || "—";

  return (
    <div className="space-y-6 animate-fade-in max-w-[1280px] mx-auto">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-800 p-7 md:p-8 text-white shadow-xl">
        <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&auto=format&fit=crop" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-overlay" />
        <div className="relative grid md:grid-cols-[1.4fr_0.6fr] gap-6 items-center">
          <div>
            <p className="inline-flex rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold tracking-widest uppercase border border-white/20">Mentor Workspace · Strict Isolation</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Cohort overview</h1>
            <p className="mt-2 text-indigo-100 text-sm leading-relaxed max-w-xl">Monitor progress and identify who needs support. <span className="font-bold text-white">Your section: {sectionLabel}</span> — mentors see only their Year-Section by design.</p>
            <div className="mt-4 inline-flex flex-wrap gap-2">
              <span className="rounded-full bg-white text-slate-900 px-3 py-1.5 text-xs font-bold">{students.length} students</span>
              <span className="rounded-full bg-white/15 text-white border border-white/20 px-3 py-1.5 text-xs font-semibold">Placement = 40% marks + 30% att + 30% resume → Risk = 1 − placement</span>
            </div>
          </div>
          <div className="hidden md:block rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg">
            <img src="https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=520&q=80&auto=format&fit=crop" alt="Team" className="h-36 w-full object-cover" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Students overseen" value={cohort.studentsOverseen} sub={`${sectionLabel} only`} accent="bg-indigo-500" />
        <StatCard label="Currently flagged" value={cohort.currentlyFlagged} sub="Risk ≥35% (Needs attention)" accent="bg-amber-500" />
        <StatCard label="Interventions / month" value={cohort.interventionsThisMonth} sub="Logged → review → delta" accent="bg-emerald-500" />
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
        <p className="text-sm font-bold text-slate-900">How scores work (new)</p>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          <span className="font-semibold text-slate-900">Placement readiness</span> uses only three ERP+resume signals: <b>marks of all exams (ASG-1 avg) 40%</b> + <b>attendance 30%</b> + <b>resume analysis score 30%</b> (no login frequency). If no resume yet, marks+attendance are 50/50. <span className="font-semibold text-slate-900">Academic risk = 1 − placement</span> — higher placement means lower risk. Click <b>Why</b> on any student to see the exact breakdown (e.g. 30% risk = low marks drags placement to 70%).
        </p>
      </div>

      {cohort.studentsOverseen === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
          No students in <span className="font-semibold text-slate-900">{sectionLabel}</span> yet. Students appear after sign-up (ERP Year/Section auto-detected).
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_0.85fr] gap-6 items-start">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Student risk table — {sectionLabel}</h2>
            <span className="text-xs text-slate-400">{students.length} rows · click Why for breakdown</span>
          </div>
          <RiskTable students={students} />
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm sticky top-6">
          <h2 className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Risk distribution</h2>
          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohort.riskDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "#6b6560" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6b6560" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e8e4de", fontSize: "13px" }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {cohort.riskDistribution.map((entry) => (
                    <Cell key={entry.bucket} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">Low &lt;35% · Moderate 35-65% · Elevated ≥65% (from 1−placement)</p>
          {students.length > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Quick snapshot</p>
              <div className="space-y-1.5 text-xs">
                {students.slice(0, 6).map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate flex-1">{s.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.academicRisk >= 0.35 ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{Math.round((s.academicRisk ?? 0) * 100)}% risk</span>
                    <span className="text-slate-500 hidden lg:inline">{s.breakdown ? `${s.breakdown.marks_pct}%m · ${s.breakdown.attendance_pct}%a${s.breakdown.has_resume ? ` · ${s.breakdown.resume_score}` : ""}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
