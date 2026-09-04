import { reasonBadgeClass, blockCardClass } from "../utils/risk";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

export default function ScheduleView({ blocks, totalHours }) {
  if (!blocks?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-elevated px-8 py-12 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary-soft flex items-center justify-center mb-3">
          <span className="text-xl">📅</span>
        </div>
        <h3 className="text-base font-semibold text-ink">No blocks yet</h3>
        <p className="mt-1 text-sm text-ink-muted max-w-md mx-auto">
          Generate your week above — important deadlines first, then regular todos, then weak subjects (≤60%).
        </p>
      </div>
    );
  }

  const byDay = DAYS.reduce((acc, d) => ({ ...acc, [d]: [] }), {});
  for (const b of blocks) {
    const day = b.day?.slice(0, 3);
    if (byDay[day] !== undefined) byDay[day].push(b);
    else byDay[DAYS[0]].push(b);
  }

  const dayHours = Object.fromEntries(DAYS.map((d) => [d, byDay[d].length]));

  return (
    <div>
      {totalHours != null && (
        <div className="flex flex-wrap gap-2 mb-3 text-xs items-center">
          <span className="rounded-full bg-primary-soft text-primary px-3 py-1 font-medium">{totalHours}h planned this week</span>
          <span className="rounded-full bg-surface-elevated border border-border px-3 py-1 text-ink-muted">{blocks.length} blocks · evening slots 18:00+</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 ml-2">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500" /> <span className="text-ink-muted">To-do</span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-2" /> <span className="text-ink-muted">Marks-based (≤60%)</span>
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {DAYS.map((day) => (
          <div key={day} className="rounded-2xl border border-border bg-surface-elevated p-3 min-h-[180px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-ink">{day}</h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${dayHours[day] ? "bg-primary text-white" : "bg-surface border border-border text-ink-muted"}`}>
                {dayHours[day] ? `${dayHours[day]}h` : "Free"}
              </span>
            </div>
            <p className="text-[10px] text-ink-muted -mt-2 mb-2">{FULL[day]}</p>
            <div className="space-y-2 flex-1">
              {byDay[day].length === 0 ? (
                <div className="h-full flex items-center justify-center py-8">
                  <p className="text-xs text-ink-muted/50 italic">Free — no study block</p>
                </div>
              ) : (
                byDay[day].map((block) => (
                  <div key={block.id} className={`rounded-xl p-2.5 border shadow-sm hover:shadow-md transition-shadow ${blockCardClass(block.reason, block.kind)}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-mono text-ink-muted bg-white/70 border border-black/5 px-1.5 py-0.5 rounded">
                        {block.start} – {block.end}
                      </p>
                      <span className="text-[10px] text-ink-muted">{block.duration || "1h"}</span>
                    </div>
                    <p className="text-sm font-semibold text-ink mt-1.5 leading-tight">{block.title || block.subject}</p>
                    {block.task && block.task !== "Study" && (
                      <p className="text-[11px] text-ink-muted truncate">{block.task}</p>
                    )}
                    <span className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none border ${reasonBadgeClass(block.reason)}`}>
                      {block.reason_label || block.reason}
                    </span>
                    {block.focus && (
                      <p className="text-[10px] text-ink-muted mt-1 leading-tight line-clamp-2">{block.focus}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-muted mt-3">
        <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1 align-middle" /> To-do (important + nearest deadlines) → <span className="inline-block w-2 h-2 rounded-full bg-sky-500 mx-1 align-middle" /> Regular todos → <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mx-1 align-middle" /> Marks ≤60% (ASG-1/2, CT-1/2)
      </p>
    </div>
  );
}
