import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, FileText, Sparkles, TrendingUp, ClipboardCheck, Award, RefreshCw, GraduationCap, ArrowRight, Clock, Target, ClipboardList } from "lucide-react";
import * as predictApi from "../api/predict";
import * as erpApi from "../api/erp";
import LoadingState from "../components/LoadingState";
import ErpConnectModal from "../components/ErpConnectModal";
import { formatPercent, readinessLabel, riskBadgeClass, riskLabel } from "../utils/risk";
import { useAuth } from "../context/AuthContext";

function StatCard({ icon: Icon, label, value, sub, accent, empty }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow ${empty ? "border-slate-200 opacity-70" : "border-slate-200"}`}>
      <div className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[48px] opacity-10 ${accent || "bg-indigo-500"}`} />
      <div className="flex items-start justify-between relative">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent ? accent + " text-white" : "bg-indigo-50 text-indigo-600"}`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-4 text-xs font-bold tracking-widest uppercase text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${empty ? "text-slate-400" : "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{sub}</p>}
    </div>
  );
}

function RingProgressCard({ value, label, sub }) {
  const pct = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  const r = 28; const c = 2 * Math.PI * r; const off = c * (1 - pct / 100);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[48px] opacity-10 bg-violet-500" />
      <p className="text-xs font-bold tracking-widest uppercase text-slate-400">{label}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-[64px] w-[64px] shrink-0">
          <svg width={64} height={64} className="-rotate-90">
            <circle cx={32} cy={32} r={r} stroke="#e2e8f0" strokeWidth={6} fill="none" />
            <circle cx={32} cy={32} r={r} stroke="#7c3aed" strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900">{pct}%</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{pct >= 75 ? "On track" : pct >= 50 ? "Building" : "Needs focus"}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{sub}</p>
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [erpMarks, setErpMarks] = useState(null);
  const [selectedTest, setSelectedTest] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [erpStatus, setErpStatus] = useState(null);
  const [showErpModal, setShowErpModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshInfo, setRefreshInfo] = useState(null);

  const loadDashboard = async () => {
    try { const d = await predictApi.getStudentDashboard(); setData(d); }
    catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadDashboard();
    const cached = erpApi.getCachedErpMarks();
    if (cached?.subjects?.length) {
      setErpMarks(cached);
      const tests = [...new Set(cached.subjects.map((s) => s.test || "CT-1"))];
      if (tests.length) setSelectedTest(tests[0]);
    } else {
      erpApi.getErpMarks().then((m) => {
        const subs = m?.subjects || m?.erp_marks || [];
        if (subs.length) {
          const payload = { subjects: subs, avg: m.avg_percent ?? m.past_marks ?? null, at: m.updated_at || m.erp_last_synced || null };
          try {
            const key = JSON.parse(localStorage.getItem("campusiq_user") || "null")?.id ? `erp_marks_cache_${JSON.parse(localStorage.getItem("campusiq_user")).id}` : null;
            if (key) localStorage.setItem(key, JSON.stringify(payload));
          } catch {}
          setErpMarks(payload);
          const tests = [...new Set(subs.map((s) => s.test || "ASG-1"))];
          if (tests.length) setSelectedTest(tests[0]);
        }
      }).catch(() => {});
    }
    if (!user) return;
    const dismissKey = `erp_modal_dismissed_${user.id}`;
    const wasDismissed = localStorage.getItem(dismissKey) === "1";
    const hasCache = !!erpApi.getCachedErpMarks()?.subjects?.length;
    erpApi.getErpStatus().then((s) => {
      setErpStatus(s);
      if (s.connected) { localStorage.removeItem(dismissKey); return; }
      if (!hasCache && !wasDismissed) setTimeout(() => setShowErpModal(true), 600);
    }).catch(() => { if (!hasCache && !wasDismissed) setTimeout(() => setShowErpModal(true), 800); });
  }, [user?.id]);

  const tests = useMemo(() => { if (!erpMarks?.subjects?.length) return []; return [...new Set(erpMarks.subjects.map((s) => s.test || "Unknown"))].sort(); }, [erpMarks]);
  useEffect(() => { if (tests.length && !selectedTest) setSelectedTest(tests[0]); }, [tests, selectedTest]);
  const filteredSubjects = useMemo(() => { if (!erpMarks?.subjects?.length) return []; if (!selectedTest) return erpMarks.subjects; return erpMarks.subjects.filter((s) => (s.test || "Unknown") === selectedTest); }, [erpMarks, selectedTest]);
  const schedulePreview = useMemo(() => {
    if (data?.schedulePreview?.length) return data.schedulePreview;
    try {
      const key = user?.id ? `schedule_cache_${user.id}` : null;
      if (!key) return [];
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return (parsed?.blocks || []).slice(0, 3).map((b) => ({ id: b.id, title: `${b.subject} · ${b.task || b.focus || ""}`.slice(0, 40), day: b.day, time: `${b.start}–${b.end}`, reason: b.reason_label || b.reason, kind: b.kind }));
    } catch { return []; }
  }, [data?.schedulePreview, user?.id, erpMarks]);
  const testAvg = useMemo(() => { if (!filteredSubjects.length) return null; const vals = filteredSubjects.map((s) => s.percent).filter((v) => v != null); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; }, [filteredSubjects]);

  const hasRiskEarly = data?.hasData === true;

  const [progressTick, setProgressTick] = useState(0);
  useEffect(() => {
    const h = () => setProgressTick((t) => t + 1);
    window.addEventListener("schedule-completed-updated", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("schedule-completed-updated", h); window.removeEventListener("storage", h); };
  }, []);
  const weeklyProgress = useMemo(() => {
    // Real check-off progress: completed blocks / total blocks from schedule cache
    try {
      const key = user?.id ? `schedule_cache_${user.id}` : null;
      const compKey = user?.id ? `schedule_completed_${user.id}` : null;
      if (!key || !compKey) return null;
      const raw = localStorage.getItem(key);
      if (!raw) return hasRiskEarly ? 0 : null;
      const parsed = JSON.parse(raw);
      const total = parsed?.blocks?.length || 0;
      if (!total) return hasRiskEarly ? 0 : null;
      const compRaw = localStorage.getItem(compKey);
      const completedMap = compRaw ? JSON.parse(compRaw) : {};
      const done = Object.values(completedMap).filter(Boolean).length;
      // also catch tick dependency
      void progressTick;
      return Math.round((done / total) * 100);
    } catch { return 0; }
  }, [hasRiskEarly, progressTick, user?.id, data?.schedulePreview]);
  const weeklyProgressSub = useMemo(() => {
    try {
      const key = user?.id ? `schedule_cache_${user.id}` : null;
      const compKey = user?.id ? `schedule_completed_${user.id}` : null;
      if (!key) return "Generate schedule to track";
      const raw = localStorage.getItem(key);
      if (!raw) return "Generate schedule to track";
      const parsed = JSON.parse(raw);
      const total = parsed?.blocks?.length || 0;
      if (!total) return "Generate schedule to track";
      const compRaw = compKey ? localStorage.getItem(compKey) : null;
      const completedMap = compRaw ? JSON.parse(compRaw) : {};
      const done = Object.values(completedMap).filter(Boolean).length;
      void progressTick;
      return `${done}/${total} done · tick to complete`;
    } catch { return "Generate schedule to track"; }
  }, [progressTick, user?.id]);

  const handleErpConnect = async (erpId, password) => {
    const res = await erpApi.connectErp(erpId, password);
    try { if (user) localStorage.removeItem(`erp_modal_dismissed_${user.id}`); } catch {}
    setErpMarks({ subjects: res.marks.subjects, avg: res.marks.avg_percent, at: res.scraped_at });
    const ts = [...new Set(res.marks.subjects.map((s) => s.test || "CT-1"))];
    if (ts.length) setSelectedTest(ts[0]);
    setErpStatus({ connected: true, erp_id: res.erp_id, last_synced_at: res.scraped_at, attendance_pct: res.attendance.attendance_pct });
    setRefreshInfo({ type: "connect", msg: `Connected — attendance ${res.attendance.attendance_pct}%`, changes: [] });
    await loadDashboard(); return res;
  };
  const handleRefresh = async () => {
    setRefreshing(true); setRefreshInfo(null);
    try {
      const res = await erpApi.refreshErp();
      setErpMarks({ subjects: res.marks.subjects, avg: res.marks.avg_percent, at: res.scraped_at });
      setErpStatus((prev) => ({ ...prev, last_synced_at: res.scraped_at, attendance_pct: res.attendance.attendance_pct }));
      setRefreshInfo({ type: "refresh", msg: res.message, changes: res.changes || [], diff: res.diff });
      await loadDashboard();
    } catch (e) { setRefreshInfo({ type: "error", msg: e.response?.data?.detail || e.message }); }
    finally { setRefreshing(false); }
  };

  if (loading) return <LoadingState message="Loading your dashboard…" />;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return null;

  const hasResume = data.resumeScore !== null && data.resumeScore !== undefined;
  const hasRisk = data.hasData === true;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 p-6 lg:p-8 text-white shadow-xl shadow-indigo-500/20">
        <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&q=80&auto=format&fit=crop" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-overlay" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold tracking-widest uppercase border border-white/20"><Sparkles className="h-3.5 w-3.5" /> CampusIQ Dashboard</p>
            <h1 className="mt-3 text-3xl lg:text-4xl font-extrabold tracking-tight">Good to see you, {user?.name?.split(" ")[0]} 👋</h1>
            <p className="mt-2 text-indigo-100">{hasRisk ? "Here's your supportive snapshot — attendance, marks, readiness and your week ahead." : "Complete your profile to unlock personalised risk scores."}</p>
            {(data.year || data.section) && (
              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white text-indigo-700 px-4 py-1.5 text-xs font-bold shadow"><GraduationCap className="h-4 w-4" /> Year {data.year || "—"} · {data.section || "—"}</span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {erpStatus?.connected ? (
              <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-700 px-5 py-2.5 text-sm font-bold shadow hover:bg-indigo-50 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${refreshing?"animate-spin":""}`} /> {refreshing?"Refreshing…":"Refresh ERP"}
              </button>
            ) : (
              <button onClick={()=>setShowErpModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-700 px-5 py-2.5 text-sm font-bold shadow hover:bg-indigo-50"><GraduationCap className="h-4 w-4" /> Connect ERP</button>
            )}
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-3 max-w-xl">
          {[{label:"Attendance",val: data.attendancePct!=null?`${Number(data.attendancePct).toFixed(1)}%`:"—"},{label:"Avg Marks",val:testAvg!=null?`${testAvg.toFixed(1)}%`:data.pastMarks!=null?`${Number(data.pastMarks).toFixed(1)}%`:"—"},{label:"Readiness",val:hasRisk?formatPercent(data.placementReadiness):"—"}].map(s=>(
            <div key={s.label} className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-3">
              <p className="text-xs font-bold tracking-widest uppercase text-indigo-100">{s.label}</p><p className="text-xl font-extrabold text-white mt-1">{s.val}</p>
            </div>
          ))}
        </div>
      </div>

      {refreshInfo && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${refreshInfo.type==="error"?"border-red-200 bg-red-50 text-red-700":"border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          <p className="font-semibold">{refreshInfo.msg}</p>
          {refreshInfo.changes?.length>0 && <ul className="mt-1 text-xs list-disc ml-4 space-y-0.5">{refreshInfo.changes.map((c,i)=><li key={i}>{c}</li>)}</ul>}
        </div>
      )}
      {erpStatus && (
        <div className={`rounded-xl border px-4 py-2.5 text-xs flex items-center justify-between ${erpStatus.connected?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-amber-200 bg-amber-50 text-amber-800"}`}>
          <span>{erpStatus.connected?`ERP linked: ${erpStatus.erp_id} · last synced ${erpStatus.last_synced_at?new Date(erpStatus.last_synced_at).toLocaleDateString():"just now"}`:"ERP not linked — connect once to sync attendance & marks"}</span>
          {!erpStatus.connected && <button onClick={()=>setShowErpModal(true)} className="font-bold underline">Connect now</button>}
        </div>
      )}

      {!hasRisk && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm flex items-center gap-4">
          <img src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=200&q=80&auto=format&fit=crop" alt="" className="h-16 w-16 rounded-xl object-cover hidden sm:block" />
          <div><p className="font-bold text-indigo-900">Unlock your scores</p><p className="text-slate-600"><Link to="/resume" className="font-semibold text-indigo-600 underline">Scan your resume</Link> to get a match score — risk and readiness update as you use the platform.</p></div>
        </div>
      )}

      {/* Stats Grid — no CGPA now, real check-off weekly progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ClipboardCheck} label="Attendance (ERP)" value={data.attendancePct!=null?`${Number(data.attendancePct).toFixed(2)}%`:"—"} sub={data.attendancePct!=null?(data.attendancePct>=75?"Above 75% — good standing":"Below 75% — needs attention"):"Sync ERP in Profile"} accent={data.attendancePct!=null?(data.attendancePct>=90?"bg-emerald-500":data.attendancePct>=75?"bg-amber-500":"bg-red-500"):null} empty={data.attendancePct==null} />
        <StatCard icon={Award} label="Avg marks (ERP)" value={testAvg!=null?`${testAvg.toFixed(1)}%`:data.pastMarks!=null?`${Number(data.pastMarks).toFixed(1)}%`:"—"} sub={selectedTest?`${selectedTest} average`:"Connect ERP"} accent="bg-violet-500" empty={testAvg==null && data.pastMarks==null} />
        <StatCard icon={FileText} label="Resume match" value={hasResume?`${data.resumeScore}/100`:"—/100"} sub={hasResume?"Latest scan":"Scan a resume"} accent="bg-cyan-500" empty={!hasResume} />
        <StatCard icon={TrendingUp} label="Placement readiness" value={hasRisk?formatPercent(data.placementReadiness):"—"} sub={hasRisk?readinessLabel(data.placementReadiness):"Not yet assessed"} accent="bg-indigo-500" empty={!hasRisk} />
        <StatCard icon={Target} label="Academic risk" value={hasRisk?formatPercent(data.academicRisk):"—"} sub={hasRisk?riskLabel(data.academicRisk):"Not yet assessed"} accent={hasRisk?(data.academicRisk>0.6?"bg-red-500":data.academicRisk>0.35?"bg-amber-500":"bg-emerald-500"):null} empty={!hasRisk} />
        <RingProgressCard value={weeklyProgress ?? 0} label="Weekly progress" sub={weeklyProgressSub} />
        <StatCard icon={Calendar} label="Up next" value={schedulePreview[0]?.title?.slice(0,18) || "—"} sub={schedulePreview[0]?`${schedulePreview[0].day} · ${schedulePreview[0].time}`:"No schedule yet"} accent="bg-slate-800" empty={!schedulePreview.length} />
      </div>

      {/* Marks by test */}
      {erpMarks ? (
        <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white"><Award className="h-5 w-5" /></span>
              <div><h2 className="text-base font-bold text-slate-900">Marks by test (ERP)</h2><p className="text-xs text-slate-500">Live from ERP — new tests appear after Refresh</p></div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Test</label>
              <select value={selectedTest} onChange={e=>setSelectedTest(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                {tests.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-xs text-slate-400 hidden sm:inline">synced {erpMarks.at?new Date(erpMarks.at).toLocaleDateString():""}</span>
            </div>
          </div>
          {filteredSubjects.length ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredSubjects.map((s,i)=>(
                  <div key={i} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${s.percent<50?"border-red-200 bg-red-50":s.percent<60?"border-amber-200 bg-amber-50":"border-slate-200 bg-slate-50"}`}>
                    <span className="font-semibold text-slate-900 truncate pr-2">{s.subject}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${s.percent<50?"bg-red-600 text-white":s.percent<60?"bg-amber-500 text-white":"bg-emerald-600 text-white"}`}>{s.percent}%</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 text-xs">
                <span className="text-slate-500"><span className="font-bold text-slate-900">{selectedTest} average {testAvg!=null?testAvg.toFixed(1)+"%":"—"}</span> · {filteredSubjects.length} subjects</span>
                <Link to="/schedule" className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700">Use in Schedule <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            </>
          ) : (<p className="text-sm text-slate-500">No subjects for {selectedTest}.</p>)}
        </section>
      ) : (
        <section className="rounded-[20px] border-2 border-dashed border-slate-200 bg-white p-8 text-center">
          <img src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&q=80&auto=format&fit=crop" alt="" className="h-20 w-20 rounded-2xl object-cover mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-900">No ERP marks yet</p><p className="text-xs text-slate-500 mt-1">Hit Connect ERP — CT-1 / ASG-1 and future tests will appear here.</p>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-indigo-600" /><h2 className="text-sm font-bold text-slate-900">This week&apos;s plan</h2></div>
            <Link to="/schedule" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">Full schedule <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {schedulePreview.length ? (
            <ul className="space-y-2.5">
              {schedulePreview.map(item=>(
                <Link key={item.id} to="/schedule" className="block group">
                  <li className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors">
                    <div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" />{item.day} · {item.time}</p></div>
                    <span className={`text-[10px] rounded-full px-2.5 py-1 border font-bold ${item.kind==='marks'?'bg-amber-50 text-amber-700 border-amber-200':item.reason?.includes('Important')?'bg-violet-50 text-violet-700 border-violet-200':'bg-sky-50 text-sky-700 border-sky-200'}`}>{item.reason}</span>
                  </li>
                </Link>
              ))}
            </ul>
          ) : (<div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center"><Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No schedule yet — generate your week in My Schedule.</p><Link to="/schedule" className="inline-flex mt-3 text-xs font-bold text-indigo-600">Go to Schedule →</Link></div>)}
        </section>

        <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-600" /><h2 className="text-sm font-bold text-slate-900">Recent study chat</h2></div>
            <Link to="/study" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">Open assistant <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {data.recentChat ? (
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 mb-2"><BookOpen className="h-3.5 w-3.5" />{data.recentChat.docTitle}</div>
              <p className="text-sm font-bold text-slate-900">{data.recentChat.question}</p>
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{data.recentChat.preview}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center">
              <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&q=80&auto=format&fit=crop" alt="" className="h-12 w-12 rounded-xl object-cover mx-auto mb-2" />
              <p className="text-sm text-slate-500">No study chats yet — upload notes in Study Assistant.</p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[20px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-indigo-600" /><h2 className="text-sm font-bold text-slate-900">Mentor feedback for you</h2></div>
          <Link to="/interventions" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <StudentInterventionPreview />
      </section>

      <ErpConnectModal open={showErpModal} onClose={(ok)=>{ if(!ok && user) try{localStorage.setItem(`erp_modal_dismissed_${user.id}`,"1");}catch{} setShowErpModal(false); }} onConnect={handleErpConnect} />
    </div>
  );
}

function StudentInterventionPreview() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!user?.id) return;
    import("../api/intervention").then((m) => m.getInterventions(user.id).then((r) => setItems(r.slice(0, 2))).catch(() => {}));
  }, [user?.id]);
  if (!items.length) return <p className="text-sm text-slate-500">No feedback yet — when your mentor logs an action (e.g. "Analyze your resume and add JD keywords"), it appears here and in <Link to="/interventions" className="underline font-semibold text-indigo-600">My Interventions</Link>.</p>;
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap"><span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-xs font-bold">{it.action}</span><span className="text-xs text-slate-500">Due {it.reviewDate ? new Date(it.reviewDate).toLocaleDateString() : "—"} · {it.riskBefore != null ? `${Math.round(it.riskBefore*100)}% → ${it.riskAfter != null ? Math.round(it.riskAfter*100)+"%" : "pending"}` : ""}</span></div>
          <p className="text-sm text-slate-700 mt-2 line-clamp-2">{it.actionNote}</p>
        </div>
      ))}
    </div>
  );
}
