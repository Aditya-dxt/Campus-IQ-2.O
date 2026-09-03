import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  FileText,
  Sparkles,
  TrendingUp,
  ClipboardCheck,
  Award,
} from "lucide-react";
import * as predictApi from "../api/predict";
import * as erpApi from "../api/erp";
import LoadingState from "../components/LoadingState";
import { formatPercent, readinessLabel, riskBadgeClass, riskLabel } from "../utils/risk";

function SummaryCard({ icon: Icon, label, value, sub, badgeClass, empty }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface-elevated p-5 animate-fade-in ${empty ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
        {badgeClass && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
            {sub}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-ink-muted">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${empty ? "text-ink-muted" : "text-ink"}`}>{value}</p>
      {!badgeClass && sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [erpMarks, setErpMarks] = useState(null);
  const [selectedTest, setSelectedTest] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    predictApi
      .getStudentDashboard()
      .then(setData)
      .catch((e) => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
    const cached = erpApi.getCachedErpMarks();
    if (cached?.subjects?.length) {
      setErpMarks(cached);
      const tests = [...new Set(cached.subjects.map((s) => s.test || "CT-1"))];
      if (tests.length) setSelectedTest(tests[0]);
    }
  }, []);

  const tests = useMemo(() => {
    if (!erpMarks?.subjects?.length) return [];
    return [...new Set(erpMarks.subjects.map((s) => s.test || "Unknown"))].sort();
  }, [erpMarks]);

  useEffect(() => {
    if (tests.length && !selectedTest) setSelectedTest(tests[0]);
  }, [tests, selectedTest]);

  const filteredSubjects = useMemo(() => {
    if (!erpMarks?.subjects?.length) return [];
    if (!selectedTest) return erpMarks.subjects;
    return erpMarks.subjects.filter((s) => (s.test || "Unknown") === selectedTest);
  }, [erpMarks, selectedTest]);

  const testAvg = useMemo(() => {
    if (!filteredSubjects.length) return null;
    const vals = filteredSubjects.map((s) => s.percent).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [filteredSubjects]);

  if (loading) return <LoadingState message="Loading your dashboard…" />;
  if (error) return <p className="text-risk-high text-sm">{error}</p>;
  if (!data) return null;

  const hasResume = data.resumeScore !== null && data.resumeScore !== undefined;
  const hasRisk   = data.hasData === true;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Good to see you</h1>
        <p className="text-ink-muted text-sm mt-1">
          {hasRisk
            ? "Here's a supportive snapshot of where you stand this week."
            : "Complete your profile below to unlock your personalised risk scores."}
        </p>
      </div>

      {!hasRisk && (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4 text-sm text-primary space-y-1">
          <p className="font-medium">Your scores will appear here once you get started.</p>
          <p className="text-ink-muted">
            👉 <Link to="/resume" className="underline underline-offset-2 hover:text-primary-hover">Scan your resume</Link> to get a match score.
            &nbsp;Your risk and readiness scores will update automatically as you use the platform.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <SummaryCard
          icon={ClipboardCheck}
          label="Attendance (ERP)"
          value={data.attendancePct != null ? `${Number(data.attendancePct).toFixed(2)}%` : "—"}
          sub={data.attendancePct != null ? (data.attendancePct >= 75 ? "Above 75% — good standing" : "Below 75% — needs attention") : "Sync ERP in Profile"}
          badgeClass={data.attendancePct != null ? (data.attendancePct >= 90 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : data.attendancePct >= 75 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200") : undefined}
          empty={data.attendancePct == null}
        />
        <SummaryCard
          icon={Award}
          label="Avg marks (ERP)"
          value={testAvg != null ? `${testAvg.toFixed(1)}%` : data.pastMarks != null ? `${Number(data.pastMarks).toFixed(1)}%` : "—"}
          sub={selectedTest ? `${selectedTest} average${erpMarks ? "" : " · sync for details"}` : data.pastMarks != null ? "Overall average" : "Sync ERP in Profile"}
          badgeClass={testAvg != null ? (testAvg >= 70 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : testAvg >= 50 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200") : undefined}
          empty={testAvg == null && data.pastMarks == null}
        />
        <SummaryCard
          icon={FileText}
          label="Resume match score"
          value={hasResume ? `${data.resumeScore}/100` : "—/100"}
          sub={hasResume ? "Based on your latest scan" : "Scan a resume to see your score"}
          empty={!hasResume}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Placement readiness"
          value={hasRisk ? formatPercent(data.placementReadiness) : "—"}
          sub={hasRisk ? readinessLabel(data.placementReadiness) : "Not yet assessed"}
          empty={!hasRisk}
        />
        <SummaryCard
          icon={Sparkles}
          label="Academic focus area"
          value={hasRisk ? formatPercent(data.academicRisk) : "—"}
          sub={hasRisk ? riskLabel(data.academicRisk) : "Not yet assessed"}
          badgeClass={hasRisk ? riskBadgeClass(data.academicRisk) : undefined}
          empty={!hasRisk}
        />
        <SummaryCard
          icon={Calendar}
          label="Up next"
          value={data.schedulePreview[0]?.title || "—"}
          sub={data.schedulePreview[0] ? `${data.schedulePreview[0].day} · ${data.schedulePreview[0].time}` : "No schedule yet"}
          empty={!data.schedulePreview.length}
        />
      </div>

      {erpMarks ? (
        <section className="rounded-2xl border border-border bg-surface-elevated p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-medium text-ink">Marks by test (ERP)</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-muted">Test:</label>
              <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)} className="rounded-xl border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {tests.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-xs text-ink-muted hidden sm:inline">synced {erpMarks.at ? new Date(erpMarks.at).toLocaleDateString() : ""}</span>
            </div>
          </div>
          {filteredSubjects.length ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredSubjects.map((s, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${s.percent < 50 ? "border-red-200 bg-red-50" : s.percent < 60 ? "border-amber-200 bg-amber-50" : "border-border bg-surface"}`}>
                    <span className="font-medium text-ink truncate pr-2">{s.subject}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${s.percent < 50 ? "bg-red-600 text-white" : s.percent < 60 ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"}`}>{s.percent}%</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-ink-muted">{selectedTest} average: <span className="font-semibold text-ink">{testAvg != null ? testAvg.toFixed(1) + "%" : "—"}</span> · {filteredSubjects.length} subjects</p>
                <Link to="/schedule" className="text-xs text-primary hover:underline">Use in My Schedule →</Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">No subjects found for {selectedTest}. If AT-2 was just added in ERP, re-sync in Profile.</p>
          )}
          <p className="text-xs text-ink-muted mt-2">New tests (CT-2, AT-2 etc.) appear automatically after you re-sync — dropdown is built from your ERP&apos;s real test list.</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface-elevated p-5 text-center">
          <p className="text-sm font-medium text-ink">No ERP marks yet</p>
          <p className="text-xs text-ink-muted mt-1">Sync your PSIT ERP in <Link to="/profile" className="text-primary underline">Profile → Connect PSIT ERP</Link> — CT-1 / AT-1 and future tests like AT-2 will appear here automatically.</p>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-border bg-surface-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-ink">This week&apos;s plan</h2>
            <Link to="/schedule" className="text-xs text-primary hover:text-primary-hover">
              Full schedule →
            </Link>
          </div>
          {data.schedulePreview.length ? (
            <ul className="space-y-3">
              {data.schedulePreview.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 border border-border/60"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-ink-muted">
                      {item.day} · {item.time}
                    </p>
                  </div>
                  <span className="text-[10px] rounded-full bg-accent-soft text-ink-muted px-2 py-0.5">
                    {item.reason}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No schedule yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-ink">Recent study chat</h2>
            <Link to="/study" className="text-xs text-primary hover:text-primary-hover">
              Open assistant →
            </Link>
          </div>
          {data.recentChat ? (
            <div className="rounded-xl bg-surface border border-border/60 p-4">
              <div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
                <BookOpen className="h-3.5 w-3.5" />
                {data.recentChat.docTitle}
              </div>
              <p className="text-sm font-medium text-ink">{data.recentChat.question}</p>
              <p className="text-sm text-ink-muted mt-2 line-clamp-2">
                {data.recentChat.preview}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No recent study chats yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
