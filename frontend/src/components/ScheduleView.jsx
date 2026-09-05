import { useEffect, useState } from "react";
import { Check, Clock3 } from "lucide-react";
import { reasonBadgeClass, blockCardClass } from "../utils/risk";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FULL = { Mon:"Monday", Tue:"Tuesday", Wed:"Wednesday", Thu:"Thursday", Fri:"Friday", Sat:"Saturday", Sun:"Sunday" };

function getUserId() {
  try { return JSON.parse(localStorage.getItem("campusiq_user") || "null")?.id || null; } catch { return null; }
}

export default function ScheduleView({ blocks, totalHours }) {
  const [completed, setCompleted] = useState({});

  useEffect(() => {
    const uid = getUserId();
    if (!uid) return;
    try {
      const raw = localStorage.getItem(`schedule_completed_${uid}`);
      if (raw) setCompleted(JSON.parse(raw));
    } catch {}
  }, [blocks]);

  // keep completed in sync when blocks change (prune stale ids on regenerate)
  useEffect(() => {
    const uid = getUserId();
    if (!uid || !blocks?.length) return;
    const ids = new Set(blocks.map(b=>b.id));
    setCompleted(prev => {
      const next = {};
      let changed = false;
      for (const [k,v] of Object.entries(prev)) if (ids.has(k) && v) next[k]=true; else if (ids.has(k)) {} else changed=true;
      // if any stale removed, persist
      if (changed || Object.keys(prev).some(k=>!ids.has(k))) {
        try { localStorage.setItem(`schedule_completed_${uid}`, JSON.stringify(next)); window.dispatchEvent(new Event("schedule-completed-updated")); } catch {}
        return next;
      }
      return prev;
    });
  }, [blocks]);

  function toggle(id) {
    const uid = getUserId();
    setCompleted(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (!next[id]) delete next[id];
      try { 
        if (uid) localStorage.setItem(`schedule_completed_${uid}`, JSON.stringify(next));
        window.dispatchEvent(new Event("schedule-completed-updated"));
      } catch {}
      return next;
    });
  }

  function clearDone() {
    const uid = getUserId();
    setCompleted({});
    try { if (uid) localStorage.setItem(`schedule_completed_${uid}`, JSON.stringify({})); window.dispatchEvent(new Event("schedule-completed-updated")); } catch {}
  }

  if (!blocks?.length) {
    return (
      <div className="rounded-[20px] border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">📅</div>
        <h3 className="mt-3 text-base font-bold text-slate-900">No blocks yet</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">Generate your week above — important deadlines first, then regular todos, then weak subjects (≤60%). Evening slots from 18:00. All blocks come from your real inputs, no mock data.</p>
      </div>
    );
  }
  const byDay = DAYS.reduce((a,d)=>({...a,[d]:[]}),{});
  for(const b of blocks){ const day=b.day?.slice(0,3); if(byDay[day]!==undefined) byDay[day].push(b); else byDay[DAYS[0]].push(b); }
  const dayHours = Object.fromEntries(DAYS.map(d=>[d,byDay[d].length]));
  const total = blocks.length;
  const done = Object.values(completed).filter(Boolean).length;
  const pct = total ? Math.round((done/total)*100) : 0;

  return (
    <div>
      <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 mb-3 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-indigo-600 text-white px-3 py-1.5 font-bold shadow">{totalHours}h planned this week</span>
          <span className="rounded-full bg-white border border-slate-200 px-3 py-1.5 text-slate-600 font-medium">{total} blocks · evening 18:00+</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 ml-1 text-slate-500">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-500" /> To-do
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" /> Weak ≤60%
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-500" style={{width: `${pct}%`}} />
            </div>
            <span className="text-xs font-bold text-slate-700 min-w-[72px]">{done}/{total} done · {pct}%</span>
          </div>
          {done>0 && <button onClick={clearDone} className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline">Reset</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {DAYS.map(day=>(
          <div key={day} className="rounded-[16px] border border-slate-200 bg-white p-3 min-h-[190px] flex flex-col shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-widest uppercase text-slate-900">{day}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dayHours[day]?"bg-indigo-600 text-white":"bg-slate-100 border border-slate-200 text-slate-400"}`}>{dayHours[day]?`${dayHours[day]}h`:"Free"}</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">{FULL[day]}</p>
            <div className="space-y-2 flex-1">
              {byDay[day].length===0 ? (
                <div className="h-full flex items-center justify-center py-8"><p className="text-xs text-slate-300 italic">Free</p></div>
              ) : byDay[day].map(block=>{
                const isDone = !!completed[block.id];
                return (
                <label key={block.id} className={`group flex gap-2.5 rounded-xl p-2.5 border shadow-sm hover:shadow transition-all cursor-pointer ${isDone ? "bg-emerald-50 border-emerald-200 opacity-90" : blockCardClass(block.reason,block.kind)}`}>
                  <input type="checkbox" checked={isDone} onChange={()=>toggle(block.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-white/90 border border-black/5 px-1.5 py-0.5 rounded text-slate-600"><Clock3 className="h-3 w-3" />{block.start}–{block.end}</span>
                      <span className="text-[10px] text-slate-400">{block.duration||"1h"}</span>
                      {isDone && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-1.5 py-0.5"><Check className="h-3 w-3" />Done</span>}
                    </div>
                    <p className={`text-sm font-bold mt-1 leading-tight ${isDone ? "text-slate-500 line-through" : "text-slate-900"}`}>{block.title||block.subject}</p>
                    {block.task && block.task!=="Study" && <p className={`text-[11px] truncate ${isDone ? "text-slate-400 line-through" : "text-slate-500"}`}>{block.task}</p>}
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${isDone ? "bg-white text-slate-500 border-slate-200" : reasonBadgeClass(block.reason)}`}>{block.reason_label||block.reason}</span>
                  </div>
                </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400 text-center">Tick a block when you finish it — Weekly progress on your dashboard updates instantly (stored per user, survives refresh). Regenerating a week resets ticks.</p>
    </div>
  );
}
