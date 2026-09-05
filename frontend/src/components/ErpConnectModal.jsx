import { useState } from "react";
import { GraduationCap, RefreshCw, X } from "lucide-react";

export default function ErpConnectModal({ open, onClose, onConnect }) {
  const [erpId, setErpId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!erpId.trim() || !password) {
      setError("Enter your ERP ID and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await onConnect(erpId.trim(), password);
      // onConnect handles caching; close modal on success
      onClose(true);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "ERP connect failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div className="relative w-full max-w-md rounded-2xl bg-surface-elevated border border-border shadow-xl p-6 animate-fade-in">
        <button onClick={() => onClose(false)} className="absolute right-3 top-3 rounded-full p-1 hover:bg-surface">
          <X className="h-4 w-4 text-ink-muted" />
        </button>
        <div className="flex items-center gap-2 mb-2">
          <div className="rounded-xl bg-primary-soft p-2">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-ink">Connect ERP</h2>
          <span className="ml-auto rounded-full bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 font-semibold">One-time setup</span>
        </div>
        <p className="text-xs text-ink-muted mb-4">
          Enter your <span className="font-medium text-ink">campus ERP</span> credentials once. We’ll sync your attendance and marks — then you can refresh from the dashboard anytime.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">ERP User ID / Roll No.</label>
            <input value={erpId} onChange={(e) => setErpId(e.target.value)} placeholder="2401640100073" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">ERP Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {error && <p className="text-xs text-risk-high bg-risk-high-bg border border-risk-high/20 rounded-xl px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Connecting…" : "Connect & sync"}
          </button>
          <p className="text-[11px] text-ink-muted text-center">Stored securely for refresh — you can update it later in Profile.</p>
        </form>
      </div>
    </div>
  );
}
