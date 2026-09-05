import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, Sparkles, Shield, BookOpen, TrendingUp } from "lucide-react";
import { dashboardPath, useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isAuthenticated && user) navigate(dashboardPath(user.role), { replace: true }); }, [isAuthenticated, user, navigate]);
  if (isAuthenticated && user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try { const profile = await login({ email, password }); navigate(dashboardPath(profile.role)); }
    catch (err) { setError(err.response?.data?.detail || err.message || "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      {/* Left - Brand / Image */}
      <div className="hidden lg:flex w-[52%] relative overflow-hidden bg-slate-900">
        <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=80&auto=format&fit=crop" alt="Campus" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/80 via-violet-600/60 to-slate-900/80" />
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <Link to="/login" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-lg"><GraduationCap className="h-6 w-6 text-indigo-600" /></div>
            <span className="text-xl font-bold text-white tracking-tight">CampusIQ</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold tracking-widest uppercase text-white border border-white/20">AI Copilot</span>
          </Link>
          <div>
            <h1 className="text-4xl font-extrabold text-white leading-tight">Your academic<br />career copilot</h1>
            <p className="mt-4 text-indigo-100 max-w-md">Resume scoring · RAG study chat · Risk prediction · Smart weekly planner — all in one role-based workspace for PSIT.</p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[{k:"93.4%",l:"Attendance sync"},{k:"77%",l:"Avg marks"},{k:"4 modules",l:"One dashboard"}].map(s=>(
                <div key={s.l} className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-3">
                  <p className="text-lg font-bold text-white">{s.k}</p><p className="text-xs text-indigo-100">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/60">Project 26_CS_3M_01 · PSIT Kanpur · Prof. Abhay Raj</p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
            <span className="text-lg font-bold">CampusIQ</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
          <p className="text-slate-500 mt-1">Sign in to continue to your workspace</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@campus.edu" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
            <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 transition-all">
              {loading ? "Signing in…" : "Sign in"} <ArrowRight className="h-4 w-4" />
            </button>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600">
              <span className="font-semibold">Demo:</span> student@campus.edu / password123 &nbsp;·&nbsp; mentor@campus.edu / password123
            </div>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">No account? <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">Create one</Link></p>
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 justify-center">
            <Shield className="h-3.5 w-3.5" /> Secure · Offline Phi-3-mini · No data leaves device
          </div>
        </div>
      </div>
    </div>
  );
}
