import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { dashboardPath, useAuth } from "../context/AuthContext";

export default function Signup() {
  const { signup, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
    branch: "",
    erpId: "",
    erpPassword: "",
    coordinatorSection: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(dashboardPath(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated && user) return null;

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.role === "student" && (!form.erpId.trim() || !form.erpPassword)) {
      setError("Student requires ERP Roll No. and ERP Password (one-time, stored for refresh).");
      return;
    }
    if (form.role === "mentor" && !form.coordinatorSection.trim()) {
      setError("Mentor requires coordinator Year-Section (e.g. CS-III-M).");
      return;
    }
    setLoading(true);
    try {
      const profile = await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        confirm_password: form.confirmPassword,
        role: form.role,
        branch: form.branch || undefined,
        erp_id: form.role === "student" ? form.erpId.trim() : undefined,
        erp_password: form.role === "student" ? form.erpPassword : undefined,
        coordinator_section: form.role === "mentor" ? form.coordinatorSection.trim().toUpperCase() : undefined,
      });
      navigate(dashboardPath(profile.role));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft mb-4">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Create your account</h1>
          <p className="text-sm text-ink-muted mt-1">Join CampusIQ as a student or mentor</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4 shadow-sm">
          {error && <p className="rounded-xl bg-risk-high-bg text-risk-high text-sm px-3 py-2">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Full name</label>
            <input name="name" required value={form.name} onChange={handleChange} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
            <input name="email" type="email" required value={form.email} onChange={handleChange} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
            <input name="password" type="password" required minLength={8} value={form.password} onChange={handleChange} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Confirm password</label>
            <input name="confirmPassword" type="password" required minLength={8} value={form.confirmPassword} onChange={handleChange} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {["student", "mentor"].map((role) => (
                <button key={role} type="button" onClick={() => setForm((f) => ({ ...f, role }))} className={`rounded-xl border py-2.5 text-sm capitalize transition-colors ${form.role === role ? "border-primary bg-primary-soft text-primary font-medium" : "border-border text-ink-muted hover:border-primary/30"}`}>{role}</button>
              ))}
            </div>
          </div>

          {form.role === "student" ? (
            <>
              <div className="rounded-xl bg-primary-soft/50 border border-primary/20 p-3 space-y-3">
                <p className="text-xs font-medium text-primary">Student — one-time ERP connect (never asked again)</p>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">ERP Roll No.</label>
                  <input name="erpId" required={form.role==="student"} value={form.erpId} onChange={handleChange} placeholder="2401640100073" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">ERP Password</label>
                  <input name="erpPassword" type="password" required={form.role==="student"} value={form.erpPassword} onChange={handleChange} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <p className="text-[11px] text-ink-muted mt-1">Stored securely — dashboard auto-fetches Year/Section/attendance/marks and Refresh re-syncs after logout too.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Branch / Major (optional)</label>
                <input name="branch" value={form.branch} onChange={handleChange} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-surface border border-border p-3 space-y-3">
                <p className="text-xs font-medium text-ink">Mentor — coordinator assignment</p>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Coordinator Year-Section</label>
                  <input name="coordinatorSection" required={form.role==="mentor"} value={form.coordinatorSection} onChange={handleChange} placeholder="CS-III-M  or  PSIT-CS-III-M" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase" />
                  <p className="text-[11px] text-ink-muted mt-1">You will see only students of this section/year — strict isolation.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Department</label>
                <input name="branch" value={form.branch} onChange={handleChange} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-colors">
            {loading ? "Creating account & syncing ERP…" : "Create account"}
          </button>
          {loading && form.role==="student" && <p className="text-xs text-ink-muted text-center">Syncing PSIT ERP (attendance + marks) — may take ~10s</p>}
        </form>

        <p className="text-center text-sm text-ink-muted mt-6">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:text-primary-hover">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
