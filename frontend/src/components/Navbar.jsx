import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, LogOut, Menu, UserCircle, X } from "lucide-react";
import { useState } from "react";
import { dashboardPath, useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface-elevated/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 lg:px-6 h-16">
        <Link
          to={dashboardPath(user?.role)}
          className="flex items-center gap-2.5 text-ink no-underline"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
            <GraduationCap className="h-5 w-5 text-primary" strokeWidth={1.75} />
          </div>
          <span className="text-lg font-semibold tracking-tight">CampusIQ</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-sm text-ink-muted mr-2">
            {user?.name}
          </span>
          <Link
            to="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors"
            title="Profile"
          >
            <UserCircle className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-muted hover:bg-surface hover:text-ink transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Logout
          </button>
          <button
            type="button"
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-surface"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-border px-4 py-3 space-y-2 bg-surface-elevated">
          <Link to="/profile" className="block py-2 text-sm" onClick={() => setMobileOpen(false)}>
            Profile
          </Link>
          <button type="button" onClick={handleLogout} className="text-sm text-ink-muted py-2">
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
