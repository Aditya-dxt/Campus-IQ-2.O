import { reasonBadgeClass } from "../utils/risk";
import EmptyState from "./EmptyState";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleView({ blocks }) {
  if (!blocks?.length) {
    return (
      <EmptyState
        title="No schedule yet"
        description="Your personalized study plan will appear here once generated."
      />
    );
  }

  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = blocks.filter((b) => b.day === day);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {DAYS.map((day) => (
        <div key={day} className="rounded-2xl border border-border bg-surface-elevated p-3 min-h-[140px]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
            {day}
          </h3>
          <div className="space-y-2">
            {byDay[day].length === 0 ? (
              <p className="text-xs text-ink-muted/60 italic">Free</p>
            ) : (
              byDay[day].map((block) => (
                <div
                  key={block.id}
                  className="rounded-xl bg-surface p-2.5 border border-border/60 animate-fade-in"
                >
                  <p className="text-xs text-ink-muted">
                    {block.start} – {block.end}
                  </p>
                  <p className="text-sm font-medium text-ink mt-0.5">{block.title}</p>
                  <span
                    className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${reasonBadgeClass(block.reason)}`}
                  >
                    {block.reason}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
