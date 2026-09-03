import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  FileText,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import * as predictApi from "../api/predict";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    predictApi
      .getStudentDashboard()
      .then(setData)
      .catch((e) => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  }, []);

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

      {/* Banner when no real data yet */}
      {!hasRisk && (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4 text-sm text-primary space-y-1">
          <p className="font-medium">Your scores will appear here once you get started.</p>
          <p className="text-ink-muted">
            👉 <Link to="/resume" className="underline underline-offset-2 hover:text-primary-hover">Scan your resume</Link> to get a match score.
            &nbsp;Your risk and readiness scores will update automatically as you use the platform.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

