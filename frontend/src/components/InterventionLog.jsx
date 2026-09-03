import { ArrowRight } from "lucide-react";
import { formatPercent } from "../utils/risk";
import EmptyState from "./EmptyState";

export default function InterventionLog({ interventions }) {
  if (!interventions?.length) {
    return (
      <EmptyState
        title="No interventions logged yet"
        description="When you log support actions, they'll appear here with risk deltas."
      />
    );
  }

  return (
    <div className="space-y-3">
      {interventions.map((item) => {
        const delta = item.riskBefore - item.riskAfter;
        return (
          <article
            key={item.id}
            className="rounded-2xl border border-border bg-surface-elevated p-4 animate-fade-in"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{item.action}</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {item.createdAt} · Review {item.reviewDate}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-lg bg-risk-mid-bg text-risk-mid px-2 py-1">
                  {formatPercent(item.riskBefore)}
                </span>
                <ArrowRight className="h-3 w-3 text-ink-muted" />
                <span className="rounded-lg bg-risk-low-bg text-risk-low px-2 py-1">
                  {formatPercent(item.riskAfter)}
                </span>
                {delta > 0 && (
                  <span className="text-risk-low font-medium">−{formatPercent(delta)}</span>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">{item.actionNote}</p>
          </article>
        );
      })}
    </div>
  );
}
