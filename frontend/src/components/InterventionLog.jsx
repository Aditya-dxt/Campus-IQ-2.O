import { ArrowRight } from "lucide-react";
import { formatPercent } from "../utils/risk";

export default function InterventionLog({ interventions, onReview }) {
  if (!interventions?.length) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <p className="font-bold text-slate-900">No interventions yet</p>
        <p className="text-sm text-slate-500 mt-1">When you log support actions, they'll appear here with before/after risk and delta.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {interventions.map((item) => {
        const hasAfter = item.riskAfter !== null && item.riskAfter !== undefined;
        const delta = hasAfter && item.riskBefore != null ? Number((item.riskAfter - item.riskBefore).toFixed(4)) : null;
        const improved = delta !== null && delta < 0;
        const worsened = delta !== null && delta > 0;
        return (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">{item.action}</p>
                <p className="text-xs text-slate-500 mt-0.5">{new Date(item.createdAt).toLocaleDateString()} · Review {item.reviewDate ? new Date(item.reviewDate).toLocaleDateString() : "—"}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                <span className="rounded-lg bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 font-bold">{item.riskBefore != null ? formatPercent(item.riskBefore) : "—"} before</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                {hasAfter ? (
                  <span className={`rounded-lg px-2 py-1 font-bold border ${improved ? "bg-emerald-50 text-emerald-700 border-emerald-200" : worsened ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{formatPercent(item.riskAfter)} after</span>
                ) : (
                  <span className="rounded-lg bg-slate-100 text-slate-500 border border-slate-200 px-2 py-1 font-medium">Pending review</span>
                )}
                {delta !== null && (
                  <span className={`font-bold px-2 py-1 rounded-lg text-xs ${improved ? "bg-emerald-600 text-white" : worsened ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                    {delta > 0 ? "+" : ""}{formatPercent(Math.abs(delta))} {improved ? "↓ improved" : worsened ? "↑ worsened" : "no change"}
                  </span>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">{item.actionNote}</p>
            {!hasAfter && onReview && (
              <button onClick={()=>onReview(item.id)} className="mt-3 inline-flex rounded-xl bg-slate-900 text-white px-4 py-1.5 text-xs font-bold hover:bg-black">Re-evaluate now (demo)</button>
            )}
          </article>
        );
      })}
    </div>
  );
}
