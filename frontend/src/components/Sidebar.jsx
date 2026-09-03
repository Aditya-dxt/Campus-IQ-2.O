import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  LayoutDashboard,
  UserCircle,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const studentLinks = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard },
  { to: "/resume", label: "Resume Scanner", icon: FileText },
  { to: "/study", label: "Study Assistant", icon: BookOpen },
  { to: "/schedule", label: "My Schedule", icon: Calendar },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

const mentorLinks = [
  { to: "/mentor", label: "Cohort Overview", icon: Users },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const links = user?.role === "mentor" ? mentorLinks : studentLinks;

  return (
    <aside className="hidden lg:block w-56 shrink-0">
      <nav className="sticky top-24 space-y-1">
        <div className="mb-4 flex items-center gap-2 px-3">
          <GraduationCap className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {user?.role === "mentor" ? "Mentor" : "Student"}
          </span>
        </div>
        {links.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-primary-soft text-primary font-medium"
                  : "text-ink-muted hover:bg-surface-elevated hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
