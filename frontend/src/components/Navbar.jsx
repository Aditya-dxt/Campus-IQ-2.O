import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, LogOut, Menu, UserCircle, X, Sparkles } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 lg:px-6 h-[64px]">
        <Link to={dashboardPath(user?.role)} className="flex items-center gap-3 no-underline">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20">
            <GraduationCap className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <span className="text-[17px] font-bold tracking-tight text-slate-900">CampusIQ</span>
            <span className="hidden sm:inline ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-indigo-600 uppercase">AI Copilot</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden sm:flex items-center gap-3 mr-2 pl-3 border-l border-slate-200">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-slate-900 leading-none">{user.name}</p>
                <p className="text-[11px] text-slate-500 capitalize">{user.role} · {user.coordinator_section || user.branch || "PSIT"}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold shadow">
                {user.name?.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
              </div>
            </div>
          )}
          <Link to="/profile" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
            <UserCircle className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <button type="button" onClick={handleLogout} className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black transition-colors">
            <LogOut className="h-4 w-4" /> Logout
          </button>
          <button type="button" className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => setMobileOpen(v=>!v)} aria-label="Toggle menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 px-4 py-3 space-y-1 bg-white">
          <Link to="/profile" className="block py-2 text-sm font-medium" onClick={()=>setMobileOpen(false)}>Profile</Link>
          <button type="button" onClick={handleLogout} className="text-sm text-slate-500 py-2">Logout</button>
        </div>
      )}
    </header>
  );
}
