import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, Shield } from "lucide-react";
import { dashboardPath, useAuth } from "../context/AuthContext";

export default function Signup() {
  const { signup, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:"", email:"", password:"", confirmPassword:"", role:"student", branch:"", erpId:"", erpPassword:"", coordinatorSection:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ if(isAuthenticated && user) navigate(dashboardPath(user.role),{replace:true}); },[isAuthenticated,user,navigate]);
  if(isAuthenticated && user) return null;
  const handleChange = e=> setForm(f=>({...f, [e.target.name]: e.target.value}));

  const handleSubmit = async e=>{
    e.preventDefault(); setError("");
    if(form.password!==form.confirmPassword) return setError("Passwords do not match.");
    if(form.role==="student" && (!form.erpId.trim()||!form.erpPassword)) return setError("Student requires ERP Roll No. and ERP Password (one-time, stored for refresh).");
    if(form.role==="mentor" && !form.coordinatorSection.trim()) return setError("Mentor requires coordinator Year-Section (e.g. CS-III-M).");
    setLoading(true);
    try{
      const profile = await signup({ name:form.name, email:form.email, password:form.password, confirm_password:form.confirmPassword, role:form.role, branch:form.branch||undefined, erp_id:form.role==="student"?form.erpId.trim():undefined, erp_password:form.role==="student"?form.erpPassword:undefined, coordinator_section:form.role==="mentor"?form.coordinatorSection.trim().toUpperCase():undefined });
      navigate(dashboardPath(profile.role));
    }catch(err){ setError(err.response?.data?.detail||err.message||"Signup failed"); } finally{ setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex w-[48%] relative overflow-hidden bg-slate-900">
        <img src="https://images.unsplash.com/photo-1494172961521-33799ddd43a5?w=1200&q=80&auto=format&fit=crop" alt="Library" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/85 via-violet-600/60 to-slate-900/90" />
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <Link to="/login" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow"><GraduationCap className="h-6 w-6 text-indigo-600" /></div>
            <span className="text-xl font-bold text-white">CampusIQ</span>
          </Link>
          <div>
            <h1 className="text-4xl font-extrabold text-white leading-tight">One workspace<br />for every student</h1>
            <p className="mt-3 text-indigo-100 max-w-md">Join with your PSIT ERP once — attendance, marks, year & section sync automatically. Mentors see only their cohort.</p>
            <div className="mt-6 space-y-2 text-sm text-white/90">
              <p>✓ One-time ERP connect · never asked again</p><p>✓ Resume → RAG Chat → Schedule → Mentor loop</p><p>✓ Offline Phi-3-mini · SHAP explainability</p>
            </div>
          </div>
          <p className="text-xs text-white/60">26_CS_3M_01 · 6 members · PSIT Kanpur</p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-6 lg:p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-md py-4 animate-fade-in">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h2>
          <p className="text-sm text-slate-500 mt-1">Student or mentor — choose your workspace</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100">
              {["student","mentor"].map(r=>(
                <button key={r} type="button" onClick={()=>setForm(f=>({...f,role:r}))} className={`rounded-lg py-2.5 text-sm font-semibold capitalize transition-all ${form.role===r?"bg-white shadow text-indigo-600 border border-slate-200":"text-slate-500 hover:text-slate-700"}`}>{r}</button>
              ))}
            </div>

            <div><label className="block text-sm font-medium text-slate-700 mb-1">Full name</label><input name="name" required value={form.name} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input name="email" type="email" required value={form.email} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Password</label><input name="password" type="password" required minLength={8} value={form.password} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Confirm</label><input name="confirmPassword" type="password" required minLength={8} value={form.confirmPassword} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" /></div>
            </div>

            {form.role==="student" ? (
              <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4 space-y-3">
                <p className="text-xs font-bold tracking-widest uppercase text-indigo-700">Student — one-time ERP connect</p>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">ERP Roll No.</label><input name="erpId" required value={form.erpId} onChange={handleChange} placeholder="2401640100073" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">ERP Password</label><input name="erpPassword" type="password" required value={form.erpPassword} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" /><p className="text-[11px] text-slate-500 mt-1">Stored securely — dashboard auto-fetches Year/Section/attendance/marks.</p></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Branch (optional)</label><input name="branch" value={form.branch} onChange={handleChange} placeholder="CSE" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm" /></div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Mentor — coordinator assignment</p>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Coordinator Year-Section</label><input name="coordinatorSection" required value={form.coordinatorSection} onChange={handleChange} placeholder="CS-III-M  or  PSIT-CS-III-M" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20" /><p className="text-[11px] text-slate-500 mt-1">You will see only students of this section — strict isolation.</p></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Department</label><input name="branch" value={form.branch} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm" /></div>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50">
              {loading ? "Creating & syncing ERP…" : "Create account"} <ArrowRight className="h-4 w-4" />
            </button>
            {loading && form.role==="student" && <p className="text-xs text-slate-500 text-center">Syncing PSIT ERP — may take ~10s</p>}
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">Already have an account? <Link to="/login" className="font-semibold text-indigo-600">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
