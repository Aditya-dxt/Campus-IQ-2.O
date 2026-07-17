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

function SummaryCard({ icon: Icon, label, value, sub, badgeClass }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-5 animate-fade-in">
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
      <p className="text-2xl font-semibold text-ink mt-1">{value}</p>
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
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading your dashboard…" />;
  if (error) return <p className="text-risk-high text-sm">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Good to see you</h1>
        <p className="text-ink-muted text-sm mt-1">
          Here&apos;s a supportive snapshot of where you stand this week.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          icon={FileText}
          label="Resume match score"
          value={`${data.resumeScore}/100`}
          sub="Room to strengthen keywords"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Placement readiness"
          value={formatPercent(data.placementReadiness)}
          sub={readinessLabel(data.placementReadiness)}
        />
        <SummaryCard
          icon={Sparkles}
          label="Academic focus area"
          value={formatPercent(data.academicRisk)}
          sub={riskLabel(data.academicRisk)}
          badgeClass={riskBadgeClass(data.academicRisk)}
        />
        <SummaryCard
          icon={Calendar}
          label="Up next"
          value={data.schedulePreview[0]?.title || "—"}
          sub={`${data.schedulePreview[0]?.day} · ${data.schedulePreview[0]?.time}`}
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
