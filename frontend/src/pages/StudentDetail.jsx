import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import * as interventionApi from "../api/intervention";
import * as predictApi from "../api/predict";
import InterventionLog from "../components/InterventionLog";
import LoadingState from "../components/LoadingState";
import {
  formatPercent,
  readinessLabel,
  riskBadgeClass,
  riskLabel,
} from "../utils/risk";

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ action: "", actionNote: "" });

  useEffect(() => {
    Promise.all([
      predictApi.getStudentById(id),
      interventionApi.getInterventions(id),
      interventionApi.getInterventionActions(),
    ])
      .then(([s, ints, acts]) => {
        setStudent(s);
        setInterventions(ints);
        setActions(acts);
        setForm((f) => ({ ...f, action: acts[0]?.id || "" }));
      })
      .catch((err) => console.error("Failed to load student data:", err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.actionNote.trim()) return;
    setSubmitting(true);
    try {
      const entry = await interventionApi.createIntervention({
        studentId: id,
        action: form.action,
        actionNote: form.actionNote,
        riskBefore: student.academicRisk,
      });
      setInterventions((prev) => [entry, ...prev]);
      setStudent((s) => ({ ...s, academicRisk: entry.riskAfter }));
      setForm((f) => ({ ...f, actionNote: "" }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading student profile…" />;
  if (!student) return <p className="text-risk-high text-sm">Student not found.</p>;

  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + 14);

  return (
    <div className="space-y-8 animate-fade-in">
      <Link
        to="/mentor"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to cohort
      </Link>

      <div className="rounded-2xl border border-border bg-surface-elevated p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{student.name}</h1>
            <p className="text-sm text-ink-muted mt-1">
              {student.branch} · {student.year} · GPA {student.gpa}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">{student.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${riskBadgeClass(student.academicRisk)}`}
            >
              Risk {formatPercent(student.academicRisk)} · {riskLabel(student.academicRisk)}
            </span>
            <span className="rounded-full bg-primary-soft text-primary px-3 py-1 text-xs font-medium">
              Placement {formatPercent(student.placementReadiness)} ·{" "}
              {readinessLabel(student.placementReadiness)}
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-muted">
          <span className="font-medium text-ink">Top factor:</span> {student.topFactor}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          <span className="font-medium text-ink">Resume score:</span> {student.resumeScore}/100
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-base font-medium text-ink mb-4">Intervention history</h2>
          <InterventionLog interventions={interventions} />
        </section>

        <section className="rounded-2xl border border-border bg-surface-elevated p-6 h-fit">
          <h2 className="text-base font-medium text-ink mb-4">Log new intervention</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Action</label>
              <select
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {actions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Notes</label>
              <textarea
                rows={4}
                required
                value={form.actionNote}
                onChange={(e) => setForm((f) => ({ ...f, actionNote: e.target.value }))}
                placeholder="Describe the intervention and expected outcome…"
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </div>
            <p className="text-xs text-ink-muted">
              Auto review date:{" "}
              <span className="font-medium text-ink">
                {reviewDate.toLocaleDateString()}
              </span>{" "}
              (14 days from today)
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Log intervention
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
