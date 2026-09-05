export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-8 py-12 text-center">
      <h3 className="text-base font-medium text-slate-900">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-slate-900-muted max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
