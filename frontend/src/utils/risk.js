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
  return `${Math.round(value * 100)}%`;
}

export function reasonBadgeClass(reason) {
  if (reason?.includes("deadline")) return "bg-risk-mid-bg text-risk-mid";
  if (reason?.includes("weak")) return "bg-risk-high-bg text-risk-high";
  if (reason?.includes("placement")) return "bg-primary-soft text-primary";
  return "bg-accent-soft text-ink-muted";
}
