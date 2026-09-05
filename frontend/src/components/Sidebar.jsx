import { Link, useLocation } from "react-router-dom";
import { BookOpen, Calendar, FileText, GraduationCap, LayoutDashboard, UserCircle, Users, Sparkles, ClipboardList } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const studentLinks = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, desc: "Overview" },
  { to: "/interventions", label: "My Interventions", icon: ClipboardList, desc: "Mentor feedback" },
  { to: "/resume", label: "Resume Scanner", icon: FileText, desc: "ATS Score" },
  { to: "/study", label: "Study Assistant", icon: BookOpen, desc: "RAG Chat" },
  { to: "/schedule", label: "My Schedule", icon: Calendar, desc: "Weekly Plan" },
  { to: "/profile", label: "Profile", icon: UserCircle, desc: "Account" },
];
const mentorLinks = [
  { to: "/mentor", label: "Cohort Overview", icon: Users, desc: "Students" },
  { to: "/profile", label: "Profile", icon: UserCircle, desc: "Account" },
];

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const links = user?.role === "mentor" ? mentorLinks : studentLinks;

  return (
    <aside className="hidden lg:block w-[240px] shrink-0">
      <nav className="sticky top-[80px] space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white shadow-lg shadow-indigo-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-indigo-200" />
            <span className="text-xs font-bold tracking-widest uppercase text-indigo-100">{user?.role === "mentor" ? "Mentor Workspace" : "Student Workspace"}</span>
          </div>
          <p className="text-sm font-medium leading-snug">AI-powered academic copilot for PSIT</p>
          <p className="text-xs text-indigo-100/80 mt-1">Track · Learn · Grow</p>
        </div>

        <div>
          <p className="px-3 mb-2 text-[11px] font-bold tracking-widest uppercase text-slate-400">Navigate</p>
          <div className="space-y-1">
            {links.map(({ to, label, icon: Icon, desc }) => {
              const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
              return (
                <Link key={to} to={to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${active ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm border border-indigo-100" : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm border border-transparent"}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Icon className="h-4 w-4" strokeWidth={active?2:1.75} />
                  </span>
                  <span className="flex-1 leading-none">{label}<span className="block text-[11px] font-normal text-slate-400">{desc}</span></span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80&auto=format&fit=crop" alt="Study" className="h-24 w-full object-cover rounded-xl mb-3" />
          <p className="text-xs font-semibold text-slate-900">Need guidance?</p>
          <p className="text-xs text-slate-500 mt-1">Mentor intervention loop tracks your growth over time.</p>
        </div>
      </nav>
    </aside>
  );
}
