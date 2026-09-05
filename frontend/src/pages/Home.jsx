import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  ArrowRight,
  Sparkles,
  Shield,
  BookOpen,
  Brain,
  CalendarDays,
  FileSearch,
  TrendingUp,
  Users,
  Zap,
  MessageCircle,
  FileText,
  BarChart3,
  Clock3,
  CheckCircle2,
  Play,
  Star,
  ChevronRight,
  Layers,
  Cpu,
  Eye,
} from "lucide-react";
import { dashboardPath, useAuth, isTokenAlive } from "../context/AuthContext";

// decode JWT payload without verifying — only for expiry check
// (shared helper is also exported from AuthContext; local wrapper for fallback)

export default function Home() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);

  // auto-redirect authenticated + non-expired token → dashboard
  useEffect(() => {
    if (loading) return;
    if (token && user && isTokenAlive(token)) {
      navigate(dashboardPath(user.role), { replace: true });
    }
  }, [loading, token, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 animate-pulse" />
          <p className="text-sm text-slate-500">Checking session…</p>
        </div>
      </div>
    );
  }
  // if alive token we will redirect — avoid flash
  if (token && user && isTokenAlive(token)) return null;

  return (
    <div className="min-h-screen bg-[#fcfcff] text-slate-900 selection:bg-indigo-200">
      {/* ---------- NAV ---------- */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-[1240px] px-4 lg:px-6 h-[64px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-[18px] font-extrabold tracking-tight">CampusIQ</span>
            <span className="hidden sm:inline rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase text-indigo-600">AI Copilot</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#how" className="hover:text-slate-900">How it works</a>
            <a href="#roles" className="hover:text-slate-900">Roles</a>
            <span className="h-4 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live at PSIT Kanpur</span>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Sign in</Link>
            <Link to="/signup" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black shadow">Get started <ArrowRight className="h-4 w-4" /></Link>
            <button onClick={() => setMobileMenu(v => !v)} className="lg:hidden ml-1 h-9 w-9 grid place-items-center rounded-xl bg-slate-100">
              <span className="text-sm font-bold">{mobileMenu ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="lg:hidden border-t bg-white px-4 py-3 space-y-2">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block py-2 text-sm">Features</a>
            <a href="#how" onClick={() => setMobileMenu(false)} className="block py-2 text-sm">How it works</a>
            <Link to="/login" className="block py-2 text-sm font-semibold text-indigo-600">Sign in</Link>
          </div>
        )}
      </header>

      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden">
        {/* gradient orbs */}
        <div className="pointer-events-none absolute -top-32 -left-40 h-[520px] w-[720px] rounded-full bg-gradient-to-br from-indigo-300 via-violet-300 to-cyan-200 opacity-30 blur-[80px]" />
        <div className="pointer-events-none absolute -top-20 right-0 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-violet-200 to-indigo-100 opacity-40 blur-[60px]" />

        <div className="mx-auto max-w-[1240px] px-4 lg:px-6 pt-10 lg:pt-14 pb-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-8 items-center">
          {/* left copy */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold shadow-sm">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"><Sparkles className="h-3 w-3" /></span>
              Offline-first · Phi-3-mini · No data leaves campus
              <span className="hidden sm:inline-flex ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold tracking-widest">BETA</span>
            </div>

            <h1 className="mt-5 text-[34px] lg:text-[52px] font-[800] leading-[0.95] tracking-[-0.03em]">
              The academic
              <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">career copilot</span>
              for every student.
            </h1>
            <p className="mt-4 text-[15px] lg:text-[17px] leading-relaxed text-slate-600 max-w-[560px]">
              CampusIQ syncs your <b className="text-slate-900">PSIT ERP once</b> — attendance, marks, year &amp; section — then turns it into resume scoring, RAG study chat, placement-risk radar and a smart weekly planner. Mentors see only their section.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700">
                Create your workspace <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-6 py-3.5 text-sm font-semibold hover:bg-slate-50">
                <Play className="h-4 w-4" /> Watch 45s demo
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> No credit card</span>
              <span className="h-3 w-px bg-slate-200" />
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> 1-time ERP connect</span>
              <span className="h-3 w-px bg-slate-200" />
              <span className="inline-flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" /> Offline LLM</span>
            </div>

            {/* mini stats */}
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-[520px]">
              {[
                { k: "93.42%", l: "Avg attendance", sub: "live ERP sync" },
                { k: "4-in-1", l: "Modules", sub: "Resume · Chat · Risk · Plan" },
                { k: "7 days", l: "Token life", sub: "auto-refresh" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-[18px] font-extrabold leading-none tracking-tight">{s.k}</p>
                  <p className="text-xs font-semibold text-slate-900">{s.l}</p>
                  <p className="text-[11px] text-slate-500">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* right visual — dashboard mock */}
          <div className="relative lg:h-[560px]">
            {/* glow behind */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600/10 via-violet-600/10 to-cyan-500/10 rounded-[32px] blur-2xl" />
            <div className="relative rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] overflow-hidden">
              {/* browser bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">app.campusiq · Student Dashboard</span>
                <span className="h-2 w-16 rounded-full bg-slate-200" />
              </div>

              <div className="p-4 lg:p-5 space-y-4 bg-gradient-to-b from-white to-slate-50">
                {/* top metrics */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Attendance", value: "93.42%", tone: "emerald", icon: BarChart3 },
                    { label: "Avg marks", value: "77 / 100", tone: "indigo", icon: TrendingUp },
                    { label: "Risk", value: "Low", tone: "amber", icon: Eye },
                  ].map((m) => (
                    <div key={m.label} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <span className={`h-7 w-7 grid place-items-center rounded-xl ${m.tone === "emerald" ? "bg-emerald-50 text-emerald-600" : m.tone === "indigo" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}>
                          <m.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{m.label}</span>
                      </div>
                      <p className="mt-2 text-sm font-extrabold">{m.value}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full ${m.tone === "emerald" ? "bg-emerald-500 w-[93%]" : m.tone === "indigo" ? "bg-indigo-500 w-[77%]" : "bg-amber-500 w-[42%]"}`} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* chart + chat preview */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Placement readiness</p>
                      <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-bold">On track</span>
                    </div>
                    {/* faux chart */}
                    <div className="mt-3 flex items-end gap-1.5 h-[68px]">
                      {[32, 54, 42, 78, 61, 88, 72, 95].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-indigo-600 to-violet-400" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>Sem 1</span><span>Sem 8</span></div>
                  </div>
                  <div className="col-span-2 rounded-2xl bg-slate-900 text-white p-3 flex flex-col">
                    <p className="text-xs font-bold flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-violet-300" /> RAG Study Chat</p>
                    <div className="mt-3 space-y-2 text-xs leading-relaxed">
                      <div className="rounded-xl bg-white/10 px-3 py-2">Explain DBMS normalisation with PSIT notes?</div>
                      <div className="rounded-xl bg-indigo-500 px-3 py-2">1NF → 2NF → 3NF reduces redundancy… (cited from your uploaded notes)</div>
                    </div>
                    <div className="mt-auto flex items-center gap-1.5 text-[11px] text-white/60"><Zap className="h-3 w-3" /> Phi-3-mini offline</div>
                  </div>
                </div>

                {/* schedule strip */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-500 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> This week · Smart scheduler</p>
                  <div className="mt-3 grid grid-cols-7 gap-1.5">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                      <div key={d} className={`rounded-xl p-2 text-center border ${i === 1 ? "bg-indigo-600 text-white border-indigo-600" : i === 3 ? "bg-amber-400 text-slate-900 border-amber-400" : "bg-slate-50 border-slate-200"}`}>
                        <p className="text-[10px] font-bold tracking-widest uppercase opacity-70">{d}</p>
                        <p className="text-[11px] font-semibold mt-1 leading-tight">{i === 1 ? "DSA • 90m" : i === 3 ? "Weak: OS" : "Study block"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* floating cards */}
            <div className="hidden lg:flex absolute -left-6 top-16 rounded-2xl bg-white border border-slate-200 shadow-xl px-3 py-2.5 items-center gap-3 animate-[float_5s_ease-in-out_infinite]">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 grid place-items-center text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-bold">ERP synced</p>
                <p className="text-[11px] text-slate-500">2401640100073 · CS-III-M</p>
              </div>
              <span className="ml-2 h-2 w-2 rounded-full bg-emerald-500" />
            </div>

            <div className="hidden lg:flex absolute -right-4 bottom-10 rounded-2xl bg-slate-900 text-white shadow-xl px-4 py-3 items-center gap-3 animate-[float_6s_ease-in-out_infinite_0.8s]">
              <div className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center"><FileSearch className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-bold">Resume score — 82/100</p>
                <p className="text-[11px] text-white/60">ATS: strong · Add 2 projects</p>
              </div>
            </div>
          </div>
        </div>

        {/* marquee */}
        <div className="border-y border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-[1240px] px-4 lg:px-6 py-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold tracking-widest uppercase text-slate-400">Trusted at</span>
            <span className="h-3 w-px bg-slate-200 hidden sm:block" />
            <div className="flex flex-wrap gap-2">
              {["PSIT Kanpur · CS-III-M", "ERP Live Sync", "Mentor-section isolation", "SHAP explainability", "Chroma RAG", "Offline LLM"].map((t) => (
                <span key={t} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">{t}</span>
              ))}
            </div>
            <span className="ml-auto hidden lg:inline-flex items-center gap-1.5 text-slate-500"><Star className="h-3.5 w-3.5 text-amber-500" /> Built for SIH & production</span>
          </div>
        </div>
      </section>

      {/* ---------- FEATURES BENTO ---------- */}
      <section id="features" className="mx-auto max-w-[1240px] px-4 lg:px-6 py-10 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-indigo-600">Everything in one workspace</p>
            <h2 className="mt-2 text-[28px] lg:text-[36px] font-extrabold tracking-tight leading-none">Four modules. One loop.</h2>
            <p className="mt-3 text-sm text-slate-600 max-w-[560px]">From resume to study chat to risk radar to weekly plan — each step feeds the next. No tab-hopping.</p>
          </div>
          <Link to="/signup" className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Explore as student <ChevronRight className="h-4 w-4" /></Link>
        </div>

        <div className="mt-8 grid lg:grid-cols-12 gap-4">
          {/* Resume scorer */}
          <div className="lg:col-span-7 rounded-[24px] border border-slate-200 bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-6 lg:p-7 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-xs font-semibold"><FileText className="h-3.5 w-3.5" /> Resume Scanner · ATS + LLM</div>
              <h3 className="mt-4 text-[22px] font-extrabold leading-tight">Score your resume in 8s — with fix-it tasks.</h3>
              <p className="mt-2 text-sm text-indigo-100 max-w-[520px]">Upload PDF → heuristic + LLM judge → score, missing skills, and one-click “Add to weekly plan”.</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { k: "82/100", l: "Example score" },
                  { k: "ATS ✓", l: "Keyword audit" },
                  { k: "→ Plan", l: "Auto-schedule fix" },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl bg-white text-slate-900 p-3">
                    <p className="font-extrabold leading-none">{s.k}</p>
                    <p className="text-xs text-slate-600">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk */}
          <div className="lg:col-span-5 rounded-[24px] border border-slate-200 bg-white p-6 flex flex-col">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center"><TrendingUp className="h-5 w-5" /></div>
            <h3 className="mt-4 text-[18px] font-extrabold">Placement-risk radar</h3>
            <p className="mt-2 text-sm text-slate-600">XGBoost on attendance + marks + resume + chat activity. SHAP tells you <i>why</i> — not just a score.</p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs"><span className="font-semibold">Risk: Low</span><span className="text-emerald-600 font-bold">▲ On track</span></div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full w-[22%] bg-emerald-500" /></div>
              <p className="mt-2 text-[11px] text-slate-500">Top driver: attendance 93% · Next: add 1 project to unlock “Strong”.</p>
            </div>
          </div>

          {/* RAG */}
          <div className="lg:col-span-5 rounded-[24px] border border-slate-200 bg-slate-900 text-white p-6 relative overflow-hidden">
            <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-violet-500/20 blur-2xl" />
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center"><Brain className="h-5 w-5" /></div>
              <h3 className="mt-4 text-[18px] font-extrabold">RAG Study Assistant</h3>
              <p className="mt-2 text-sm text-white/70">Upload notes → Chroma → Phi-3-mini answers <i>from your material</i>. Cited, offline, private.</p>
              <div className="mt-4 rounded-xl bg-white text-slate-900 p-3 text-xs leading-relaxed">
                <p className="font-semibold">Q: Explain deadlock prevention?</p>
                <p className="mt-1 text-slate-600">From <b>OS_Notes.pdf p.12</b>: “Avoid circular wait by ordering resources…”</p>
              </div>
            </div>
          </div>

          {/* Scheduler */}
          <div className="lg:col-span-7 rounded-[24px] border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center"><CalendarDays className="h-5 w-5" /></div>
              <div>
                <h3 className="text-[18px] font-extrabold leading-none">Smart weekly planner</h3>
                <p className="text-xs text-slate-500">Tiered: weak subjects → todos → marks. Click any block → detail.</p>
              </div>
              <span className="ml-auto hidden sm:inline-flex rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-bold">Auto-built</span>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[
                { t: "DSA Practice", c: "bg-indigo-600 text-white" },
                { t: "OS — Weak", c: "bg-amber-400 text-slate-900" },
                { t: "Resume fix", c: "bg-violet-600 text-white" },
                { t: "Mock test", c: "bg-slate-900 text-white" },
                { t: "CN Revision", c: "bg-cyan-500 text-white" },
                { t: "Project work", c: "bg-emerald-500 text-white" },
                { t: "Rest / Review", c: "bg-slate-100 text-slate-700 border border-slate-200" },
                { t: "Mentor sync", c: "bg-white text-slate-700 border border-slate-200" },
              ].map((b) => (
                <div key={b.t} className={`rounded-xl px-3 py-3 text-xs font-semibold ${b.c}`}>{b.t}</div>
              ))}
            </div>
          </div>

          {/* two small */}
          <div className="lg:col-span-6 rounded-[24px] border border-slate-200 bg-white p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 grid place-items-center text-indigo-600"><Users className="h-6 w-6" /></div>
            <div>
              <h4 className="font-extrabold">Mentor console — section-isolated</h4>
              <p className="text-sm text-slate-600">Mentors pick a Year-Section (CS-III-M) and see <i>only</i> that cohort. Risk table + nudges.</p>
            </div>
          </div>
          <div className="lg:col-span-6 rounded-[24px] border border-slate-200 bg-white p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-50 grid place-items-center text-violet-600"><Layers className="h-6 w-6" /></div>
            <div>
              <h4 className="font-extrabold">One-time ERP · Never again</h4>
              <p className="text-sm text-slate-600">Roll + password stored once, year/section/attendance/marks auto-hydrate on every login.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how" className="bg-slate-900 text-white">
        <div className="mx-auto max-w-[1240px] px-4 lg:px-6 py-10 lg:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[28px] lg:text-[32px] font-extrabold tracking-tight">How CampusIQ works</h2>
            <p className="text-sm text-white/60 max-w-[520px]">Four steps, one continuous loop — from ERP to mentor nudge.</p>
          </div>
          <div className="mt-8 grid lg:grid-cols-4 gap-4">
            {[
              { n: "01", t: "Connect ERP once", d: "Student enters PSIT Roll + password at signup. We fetch year, section, attendance, marks.", icon: Shield },
              { n: "02", t: "Resume → Chat", d: "Upload resume for scoring; chat with your own notes via offline RAG.", icon: FileSearch },
              { n: "03", t: "Risk + Schedule", d: "ML predicts placement risk (SHAP) and auto-builds a tiered weekly plan.", icon: BarChart3 },
              { n: "04", t: "Mentor nudges", d: "Mentor sees only their section, sends interventions; student checks off & closes the loop.", icon: Users },
            ].map((s) => (
              <div key={s.n} className="rounded-[20px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-widest text-white/50">{s.n}</span>
                  <span className="h-8 w-8 grid place-items-center rounded-xl bg-white text-slate-900"><s.icon className="h-4 w-4" /></span>
                </div>
                <h3 className="mt-4 font-extrabold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- ROLES ---------- */}
      <section id="roles" className="mx-auto max-w-[1240px] px-4 lg:px-6 py-10 lg:py-14">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 lg:p-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700"><BookOpen className="h-3.5 w-3.5" /> For Students</div>
            <h3 className="mt-4 text-[22px] font-extrabold">Your semester, autopiloted.</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {["ERP auto-sync every login — no manual entry", "Resume score + actionable fixes in one click", "Ask your notes, not the internet — cited answers", "Weekly plan that adapts to weak subjects & todos"].map((t) => (
                <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> <span className="text-slate-700">{t}</span></li>
              ))}
            </ul>
            <Link to="/signup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Join as student <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-6 lg:p-7 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-xs font-bold"><Users className="h-3.5 w-3.5" /> For Mentors</div>
              <h3 className="mt-4 text-[22px] font-extrabold">Only your cohort. Zero noise.</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-violet-50">
                {["Pick Year-Section (e.g. CS-III-M) — strict isolation", "Risk table sorted by need: high → mid → low", "One-click nudges + intervention log", "Student detail drawer with SHAP drivers"].map((t) => (
                  <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-white mt-0.5 shrink-0" /> <span>{t}</span></li>
                ))}
              </ul>
              <Link to="/signup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700">Join as mentor <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA STRIP ---------- */}
      <section className="mx-auto max-w-[1240px] px-4 lg:px-6 pb-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="hidden sm:grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow"><GraduationCap className="h-7 w-7" /></div>
            <div>
              <h3 className="text-[20px] font-extrabold tracking-tight">Ready when you are.</h3>
              <p className="text-sm text-slate-600">Create account with your ERP once — dashboard is live in under 15 seconds.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold hover:bg-slate-50">Sign in</Link>
            <Link to="/signup" className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black inline-flex items-center gap-2">Get started free <Sparkles className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-[1240px] px-4 lg:px-6 py-8 flex flex-col lg:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-900 grid place-items-center text-white"><GraduationCap className="h-4 w-4" /></div>
            <div>
              <p className="font-bold leading-none">CampusIQ — Project 26_CS_3M_01</p>
              <p className="text-xs text-slate-500">PSIT Kanpur · SIH 2026 · Offline-first AI copilot</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-500 text-xs">
            <span>© 2026 CampusIQ</span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> All systems operational</span>
          </div>
        </div>
      </footer>

      <style>{`@keyframes float{0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}
