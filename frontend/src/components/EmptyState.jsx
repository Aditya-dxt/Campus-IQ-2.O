export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-elevated px-8 py-12 text-center">
      <h3 className="text-base font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-ink-muted max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
