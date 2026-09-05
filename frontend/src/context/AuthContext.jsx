import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

const TOKEN_KEY = "campusiq_token";
const USER_KEY = "campusiq_user";

export function isTokenAlive(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return true;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      // if token expired, clear session so Home shows correctly
      if (!isTokenAlive(storedToken)) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        try { localStorage.removeItem("erp_marks_cache"); } catch {}
        try { localStorage.removeItem("erp_connected"); } catch {}
      } else {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    }
    setLoading(false);
  }, []);

  const persistSession = (session) => {
    localStorage.setItem(TOKEN_KEY, session.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.access_token);
    setUser(session.user);
  };

  const login = async (credentials) => {
    const session = await authApi.login(credentials);
    persistSession(session);
    return session.user;
  };

  const signup = async (payload) => {
    const session = await authApi.signup(payload);
    persistSession(session);
    return session.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // do NOT clear per-user erp cache — each account keeps its own erp_marks_cache_<id>
    // generic legacy key is cleared to prevent cross-account leak on shared device
    try { localStorage.removeItem("erp_marks_cache"); } catch {}
    try { localStorage.removeItem("erp_connected"); } catch {}
    setToken(null);
    setUser(null);
  };

  const updateUser = (updates) => {
    const next = { ...user, ...updates };
    setUser(next);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
  };

  const value = useMemo(
    () => ({ user, token, loading, login, signup, logout, updateUser, isAuthenticated: !!user && isTokenAlive(token) }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function dashboardPath(role) {
  return role === "mentor" ? "/mentor" : "/student";
}
