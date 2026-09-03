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

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated px-5 py-4">
      <p className="text-xs text-ink-muted uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}

export default function MentorDashboard() {
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
  if (error) return <p className="text-risk-high text-sm">{error}</p>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cohort overview</h1>
        <p className="text-sm text-ink-muted mt-1">
          Monitor student progress and identify who may benefit from support.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Students overseen" value={cohort.studentsOverseen} />
        <StatCard label="Currently flagged" value={cohort.currentlyFlagged} />
        <StatCard label="Interventions this month" value={cohort.interventionsThisMonth} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <h2 className="text-base font-medium text-ink mb-4">Student risk table</h2>
          <RiskTable students={students} />
        </div>

        <div className="rounded-2xl border border-border bg-surface-elevated p-5">
          <h2 className="text-base font-medium text-ink mb-4">Risk distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohort.riskDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "#6b6560" }} />
                <YAxis tick={{ fontSize: 12, fill: "#6b6560" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e8e4de",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {cohort.riskDistribution.map((entry) => (
                    <Cell key={entry.bucket} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-muted mt-3 text-center">
            Students grouped by academic risk level
          </p>
        </div>
      </div>
    </div>
  );
}
