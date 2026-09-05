import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, Search, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPercent, readinessLabel, riskBadgeClass, riskLabel } from "../utils/risk";

function Breakdown({ s }) {
  const b = s.breakdown;
  if (!b) return <span className="text-xs text-slate-400">—</span>;
  const items = [
    { label: "Marks", pct: b.marks_pct, weight: b.weights?.marks, color: "bg-indigo-500", bg: "bg-indigo-50" },
    { label: "Attendance", pct: b.attendance_pct, weight: b.weights?.attendance, color: "bg-violet-500", bg: "bg-violet-50" },
    ...(b.has_resume ? [{ label: `Resume ${b.resume_score}/100`, pct: b.resume_pct, weight: b.weights?.resume, color: "bg-emerald-500", bg: "bg-emerald-50" }] : [{ label: "Resume — not yet", pct: 0, weight: 0, color: "bg-slate-300", bg: "bg-slate-50" }]),
  ];
  return (
    <div className="space-y-2 min-w-[220px]">
      <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">{b.formula}</p>
      <p className="text-xs font-semibold text-slate-700">Placement {formatPercent(s.placementReadiness)} · Risk {formatPercent(s.academicRisk)} = 1 − placement</p>
      <div className="grid gap-1.5">
        {items.map((it) => (
          <div key={it.label} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${it.bg} border border-slate-100`}>
            <div className={`h-2 w-2 rounded-full ${it.color}`} />
            <span className="text-xs font-semibold text-slate-700 flex-1">{it.label}</span>
            <span className="text-xs font-bold text-slate-900">{it.pct?.toFixed ? `${it.pct.toFixed(1)}%` : `${it.pct}%`}</span>
            <span className="text-[10px] text-slate-500">×{it.weight}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Top drag: <span className="font-bold text-amber-700">{s.topFactor}</span></p>
    </div>
  );
}

export default function RiskTable({ students }) {
  const [search,setSearch]=useState(""); const [sortKey,setSortKey]=useState("academicRisk"); const [sortDir,setSortDir]=useState("desc"); const [riskFilter,setRiskFilter]=useState("all");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(()=>{
    let rows=[...students];
    if(search.trim()){ const q=search.toLowerCase(); rows=rows.filter(s=>s.name.toLowerCase().includes(q)||s.branch.toLowerCase().includes(q)||s.email.toLowerCase().includes(q)); }
    if(riskFilter==="low") rows=rows.filter(s=>s.academicRisk<0.35);
    else if(riskFilter==="mid") rows=rows.filter(s=>s.academicRisk>=0.35&&s.academicRisk<0.65);
    else if(riskFilter==="high") rows=rows.filter(s=>s.academicRisk>=0.65);
    rows.sort((a,b)=>{ const av=a[sortKey], bv=b[sortKey]; if(typeof av==="string") return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av); const an = av ?? -1, bn = bv ?? -1; return sortDir==="asc"?an-bn:bn-an; });
    return rows;
  },[students,search,sortKey,sortDir,riskFilter]);

  const toggleSort = key=>{ if(sortKey===key) setSortDir(d=>d==="asc"?"desc":"asc"); else{ setSortKey(key); setSortDir("desc"); } };

  if(!students.length) return (
    <div className="rounded-[20px] border-2 border-dashed border-slate-200 bg-white p-8 text-center">
      <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" /><p className="font-bold text-slate-900">No students in cohort</p><p className="text-sm text-slate-500">Students will appear here after they sign up in your section.</p>
    </div>
  );

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, branch, email…" className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        </div>
        <select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium">
          <option value="all">All risk levels</option><option value="low">On track (&lt;35%)</option><option value="mid">Needs attention</option><option value="high">Extra support</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-slate-500 bg-slate-50/50">
            <th className="px-4 py-3 font-semibold"><button onClick={()=>toggleSort("name")} className="inline-flex items-center gap-1 hover:text-slate-900">Student <ArrowUpDown className="h-3 w-3" /></button></th>
            <th className="px-4 py-3 font-semibold hidden md:table-cell">Branch</th>
            <th className="px-4 py-3 font-semibold"><button onClick={()=>toggleSort("academicRisk")} className="inline-flex items-center gap-1 hover:text-slate-900">Risk <ArrowUpDown className="h-3 w-3" /></button></th>
            <th className="px-4 py-3 font-semibold hidden sm:table-cell"><button onClick={()=>toggleSort("placementReadiness")} className="inline-flex items-center gap-1 hover:text-slate-900">Placement <ArrowUpDown className="h-3 w-3" /></button></th>
            <th className="px-4 py-3 font-semibold">Why</th>
            <th className="px-4 py-3" />
          </tr></thead>
          <tbody>
            {filtered.length===0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No matches</td></tr> : filtered.map(s=>(
              <>
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900">{s.name}</p><p className="text-xs text-slate-500 md:hidden">{s.branch}</p><p className="text-xs text-slate-400 hidden sm:block">{s.email}</p></td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{s.branch}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${riskBadgeClass(s.academicRisk)}`}>{formatPercent(s.academicRisk)} · {riskLabel(s.academicRisk)}</span></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><span className="font-semibold text-slate-900">{formatPercent(s.placementReadiness)}</span><span className="block text-xs text-slate-500">{readinessLabel(s.placementReadiness)}</span></td>
                  <td className="px-4 py-3">
                    <button onClick={()=> setExpanded(expanded===s.id ? null : s.id)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      {expanded===s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} {s.topFactor || "View"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right"><Link to={`/mentor/students/${s.id}`} className="inline-flex rounded-full bg-slate-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-black">View →</Link></td>
                </tr>
                {expanded===s.id && (
                  <tr key={s.id+"-exp"} className="bg-slate-50/70 border-b border-slate-200">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4">
                        <Breakdown s={s} />
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">How risk is derived</p>
                          <p className="text-sm leading-relaxed text-slate-600">
                            <span className="font-bold text-slate-900">Placement</span> uses only <span className="font-semibold">marks (40%)</span> + <span className="font-semibold">attendance (30%)</span> + <span className="font-semibold">resume (30%)</span>
                            {s.breakdown?.has_resume ? ` — your resume ${s.breakdown.resume_score}/100 is included.` : " — no resume yet, so marks+attendance only (50/50)."}
                            <br /><span className="font-bold text-slate-900">Risk = 1 − placement</span> — so {formatPercent(s.placementReadiness)} placement → {formatPercent(s.academicRisk)} risk.
                            Lowest component (<span className="font-bold text-amber-700">{s.topFactor}</span>) drags placement down most.
                          </p>
                          <p className="text-xs text-slate-500 mt-2">Example: Aditya 77% marks + 93% att + 98 resume → 0.40×77 + 0.30×93 + 0.30×98 = 88% placement → 12% risk.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
