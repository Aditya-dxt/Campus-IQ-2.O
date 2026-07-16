import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPercent, readinessLabel, riskBadgeClass, riskLabel } from "../utils/risk";
import EmptyState from "./EmptyState";

export default function RiskTable({ students }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("academicRisk");
  const [sortDir, setSortDir] = useState("desc");
  const [riskFilter, setRiskFilter] = useState("all");

  const filtered = useMemo(() => {
    let rows = [...students];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.branch.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q),
      );
    }
    if (riskFilter === "low") rows = rows.filter((s) => s.academicRisk < 0.35);
    else if (riskFilter === "mid")
      rows = rows.filter((s) => s.academicRisk >= 0.35 && s.academicRisk < 0.65);
    else if (riskFilter === "high") rows = rows.filter((s) => s.academicRisk >= 0.65);

    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [students, search, sortKey, sortDir, riskFilter]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (!students.length) {
    return (
      <EmptyState
        title="No students in cohort"
        description="Student risk data will appear here once available."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, branch, email…"
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="all">All risk levels</option>
          <option value="low">On track</option>
          <option value="mid">Needs attention</option>
          <option value="high">Extra support</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-muted">
              <th className="px-4 py-3 font-medium">
                <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-ink">
                  Student <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Branch</th>
              <th className="px-4 py-3 font-medium">
                <button type="button" onClick={() => toggleSort("academicRisk")} className="inline-flex items-center gap-1 hover:text-ink">
                  Academic risk <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">
                <button type="button" onClick={() => toggleSort("placementReadiness")} className="inline-flex items-center gap-1 hover:text-ink">
                  Placement <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Top factor</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  No students match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-b border-border/60 hover:bg-surface/80 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-ink-muted md:hidden">{s.branch}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted hidden md:table-cell">{s.branch}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${riskBadgeClass(s.academicRisk)}`}>
                      {formatPercent(s.academicRisk)} · {riskLabel(s.academicRisk)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-ink">{formatPercent(s.placementReadiness)}</span>
                    <span className="block text-xs text-ink-muted">{readinessLabel(s.placementReadiness)}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-xs hidden lg:table-cell max-w-[200px] truncate">
                    {s.topFactor}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/mentor/students/${s.id}`}
                      className="text-xs font-medium text-primary hover:text-primary-hover"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
