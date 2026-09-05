export function reasonBadgeClass(reason) {
  if (reason?.includes("todo-important")) return "bg-purple-100 text-purple-700 border border-purple-200";
  if (reason?.includes("todo-urgent")) return "bg-orange-100 text-orange-700 border border-orange-200";
  if (reason?.includes("todo")) return "bg-sky-100 text-sky-700 border border-sky-200";
  if (reason?.includes("deadline")) return "bg-sky-100 text-sky-700 border border-sky-200";
  if (reason?.includes("weak")) return "bg-red-50 text-red-700 border border-red-200";
  if (reason?.includes("placement")) return "bg-primary-soft text-primary border border-primary/20";
  return "bg-accent-soft text-ink-muted border border-border";
}

export function blockCardClass(reason, kind) {
  // todo tasks — purple/sky tint; marks tasks — amber/red tint
  if (kind === "todo" || reason?.includes("todo") || reason?.includes("deadline")) {
    if (reason?.includes("important")) return "bg-purple-50 border-purple-200";
    if (reason?.includes("urgent")) return "bg-orange-50 border-orange-200";
    return "bg-sky-50 border-sky-200";
  }
  if (reason?.includes("weak")) return "bg-amber-50 border-amber-200";
  return "bg-surface border-border/60";
}

export function riskLevel(value) {
  if (value < 0.35) return "low";
  if (value < 0.65) return "mid";
  return "high";
}

export function riskLabel(value) {
  const level = riskLevel(value);
  if (level === "low") return "On track";
  if (level === "mid") return "Needs attention";
  return "Extra support";
}

export function riskBadgeClass(value) {
  const level = riskLevel(value);
  if (level === "low") return "bg-risk-low-bg text-risk-low";
  if (level === "mid") return "bg-risk-mid-bg text-risk-mid";
  return "bg-risk-high-bg text-risk-high";
}

export function readinessLabel(value) {
  if (value >= 0.7) return "Strong momentum";
  if (value >= 0.5) return "Building steadily";
  return "Room to grow";
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}
