import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Save, GraduationCap, RefreshCw } from "lucide-react";
import * as predictApi from "../api/predict";
import * as erpApi from "../api/erp";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { formatPercent, readinessLabel, riskLabel } from "../utils/risk";

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-3 border-b border-border/60 last:border-0 cursor-pointer">
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </label>
  );
}

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({});
  const [notifications, setNotifications] = useState({
    email: true,
    schedule: true,
    riskAlerts: user?.role === "mentor",
  });
  const [summary, setSummary] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [loading, setLoading] = useState(user?.role === "student");
  const [saved, setSaved] = useState(false);
  // ERP connect state
  const [erpId, setErpId] = useState("");
  const [erpPassword, setErpPassword] = useState("");
  const [erpLoading, setErpLoading] = useState(false);
  const [erpResult, setErpResult] = useState(null);
  const [erpError, setErpError] = useState("");
  const [erpProfile, setErpProfile] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        branch: user.branch || "",
        year: user.year || "",
        gpa: user.gpa || "",
        cohort: user.cohort || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "student") {
      predictApi
        .getStudentDashboard()
        .then(setSummary)
        .catch((err) => console.error("Failed to load dashboard stats:", err))
        .finally(() => setLoading(false));
      erpApi.getErpProfile().then(setErpProfile).catch(() => {});
    } else if (user?.role === "mentor") {
      predictApi
        .getCohortStats()
        .then(setCohort)
        .catch((err) => console.error("Failed to load cohort stats:", err))
        .finally(() => setLoading(false));
    }
  }, [user?.role]);

  const handleErpConnect = async (e) => {
    e.preventDefault();
    setErpError("");
    setErpResult(null);
    if (!erpId.trim() || !erpPassword) {
      setErpError("Enter your PSIT ERP ID and password.");
      return;
    }
    setErpLoading(true);
    try {
      const res = await erpApi.connectErp(erpId.trim(), erpPassword);
      setErpResult(res);
      setErpProfile({ attendance_pct: res.attendance.attendance_pct, updated_at: res.scraped_at });
      // refresh dashboard summary
      const d = await predictApi.getStudentDashboard();
      setSummary(d);
    } catch (err) {
      setErpError(err.response?.data?.detail || err.message || "ERP sync failed");
    } finally {
      setErpLoading(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateUser(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null;

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary text-xl font-semibold">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ink">{user.name}</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
          <span className="inline-block mt-1 rounded-full bg-accent-soft text-ink-muted px-2.5 py-0.5 text-xs capitalize">
            {user.role}
          </span>
        </div>
      </div>

      {user.role === "student" && loading && (
        <LoadingState message="Loading score summary…" />
      )}

      {user.role === "student" && summary && !loading && (
        <div className="rounded-2xl border border-border bg-surface-elevated p-5">
          <h2 className="text-sm font-medium text-ink mb-3">Score summary</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold text-primary">{summary.resumeScore ?? "—"}</p>
              <p className="text-xs text-ink-muted">Resume</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">
                {summary.placementReadiness != null ? formatPercent(summary.placementReadiness) : "—"}
              </p>
              <p className="text-xs text-ink-muted">{summary.placementReadiness != null ? readinessLabel(summary.placementReadiness) : "Not assessed"}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">
                {summary.academicRisk != null ? formatPercent(summary.academicRisk) : "—"}
              </p>
              <p className="text-xs text-ink-muted">{summary.academicRisk != null ? riskLabel(summary.academicRisk) : "Not assessed"}</p>
            </div>
          </div>
          {erpProfile?.attendance_pct != null && (
            <p className="text-xs text-ink-muted mt-3 text-center">ERP attendance: <span className="font-semibold text-ink">{erpProfile.attendance_pct}%</span> {erpProfile.updated_at ? `· synced ${new Date(erpProfile.updated_at).toLocaleDateString()}` : ""}</p>
          )}
        </div>
      )}

      {/* PSIT ERP Connect — authentic real-data sync */}
      {user.role === "student" && (
        <div className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h2 className="text-base font-medium text-ink">Connect PSIT ERP — real attendance</h2>
          </div>
          <p className="text-xs text-ink-muted">Enter your <span className="font-medium text-ink">erp.psit.ac.in</span> credentials once. We scrape your Dashboard attendance (<span className="font-mono">TL | P | PF | Ab</span>) and update your CampusIQ profile. Credentials are <span className="font-medium">not stored</span> — re-enter to sync again. Your screenshot shows <span className="font-mono">TL-305 | P-280 | PF-8 | Ab-17 → 94.43%</span>.</p>
          <form onSubmit={handleErpConnect} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">ERP User ID / Roll No.</label>
                <input value={erpId} onChange={(e) => setErpId(e.target.value)} placeholder="2401640100073" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">ERP Password</label>
                <input type="password" value={erpPassword} onChange={(e) => setErpPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <button type="submit" disabled={erpLoading} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${erpLoading ? "animate-spin" : ""}`} />
              {erpLoading ? "Syncing with ERP…" : "Sync my real attendance"}
            </button>
          </form>
          {erpError && <p className="text-sm text-risk-high bg-risk-high-bg border border-risk-high/20 rounded-xl px-3 py-2">{erpError}</p>}
          {erpResult && (
            <div className="rounded-xl bg-surface border border-border p-4 text-sm space-y-2">
              <p className="font-medium text-ink">✓ Synced: {erpResult.attendance.attendance_pct}% attendance {erpResult.marks?.subjects?.length ? `· ${erpResult.marks.subjects.length} marks` : ""}</p>
              <p className="text-xs text-ink-muted">TL {erpResult.attendance.tl} | P {erpResult.attendance.present} | PF {erpResult.attendance.pf} | Ab {erpResult.attendance.absent} · With PF {erpResult.attendance.with_pf_pct}% · Without PF {erpResult.attendance.without_pf_pct}% {erpResult.attendance.section ? `· ${erpResult.attendance.section}` : ""}</p>
              {erpResult.marks?.subjects?.length > 0 && (
                <div className="rounded-lg border border-border bg-surface-elevated p-2">
                  <p className="text-xs font-medium text-ink">Marks synced: {erpResult.marks.avg_percent != null ? `${erpResult.marks.avg_percent}% avg` : ""} — {[...new Set(erpResult.marks.subjects.map((s)=>s.test))].join(", ")}</p>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                    {erpResult.marks.subjects.slice(0, 6).map((s, i) => <span key={i} className="truncate">{s.subject}: {s.percent}% ({s.test})</span>)}
                  </div>
                  <p className="text-xs text-ink-muted mt-1">View all by test on Dashboard → test dropdown. Schedule will prioritize low %.</p>
                </div>
              )}
              <p className="text-xs text-ink-muted">{erpResult.message}</p>
              {(!erpResult.marks?.subjects?.length && erpResult.marks_debug?.length > 0) && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-ink-muted">No marks found — tap for debug</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-all bg-surface-elevated border border-border rounded p-2 text-[11px]">{erpResult.marks_debug.join("\n")}</pre>
                  <p className="text-ink-muted mt-1">Your ERP shows “No data available” for CT-1/ASG-1 right now — that’s why. After PSIT publishes AT-2, re-sync and the dropdown will auto-add it. If marks exist but still not found, copy this debug and send to support.</p>
                </details>
              )}
            </div>
          )}
          {erpProfile && !erpResult && erpProfile.attendance_pct != null && (
            <p className="text-xs text-ink-muted">Last synced attendance: <span className="font-semibold">{erpProfile.attendance_pct}%</span></p>
          )}
        </div>
      )}

      {user.role === "mentor" && cohort && !loading && (
        <div className="rounded-2xl border border-border bg-surface-elevated p-5">
          <h2 className="text-sm font-medium text-ink mb-3">Cohort at a glance</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold text-ink">{cohort.studentsOverseen}</p>
              <p className="text-xs text-ink-muted">Students overseen</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-risk-mid">{cohort.currentlyFlagged}</p>
              <p className="text-xs text-ink-muted">Currently flagged</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-primary">
                {cohort.interventionsThisMonth}
              </p>
              <p className="text-xs text-ink-muted">Interventions / month</p>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4"
      >
        <h2 className="text-base font-medium text-ink">Account details</h2>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {user.role === "student" ? (
          <>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Branch</label>
              <input
                value={form.branch}
                onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Year</label>
                <input
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">GPA</label>
                <input
                  value={form.gpa}
                  onChange={(e) => setForm((f) => ({ ...f, gpa: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Cohort</label>
            <input
              value={form.cohort}
              onChange={(e) => setForm((f) => ({ ...f, cohort: e.target.value }))}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Save className="h-4 w-4" />
          {saved ? "Saved!" : "Save changes"}
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-surface-elevated p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-ink-muted" />
          <h2 className="text-base font-medium text-ink">Notifications</h2>
        </div>
        <Toggle
          label="Email updates"
          checked={notifications.email}
          onChange={(v) => setNotifications((n) => ({ ...n, email: v }))}
        />
        <Toggle
          label="Schedule reminders"
          checked={notifications.schedule}
          onChange={(v) => setNotifications((n) => ({ ...n, schedule: v }))}
        />
        {user.role === "mentor" && (
          <Toggle
            label="Risk alert notifications"
            checked={notifications.riskAlerts}
            onChange={(v) => setNotifications((n) => ({ ...n, riskAlerts: v }))}
          />
        )}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm text-ink-muted hover:bg-risk-high-bg hover:text-risk-high hover:border-risk-high/30 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </div>
  );
}
