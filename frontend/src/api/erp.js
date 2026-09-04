import { apiClient } from "./client";

function userCacheKey() {
  try {
    const u = JSON.parse(localStorage.getItem("campusiq_user") || "null");
    if (u?.id) return `erp_marks_cache_${u.id}`;
  } catch {}
  return null;
}

function saveCache(payload) {
  try {
    const key = userCacheKey();
    if (key) localStorage.setItem(key, JSON.stringify(payload));
    // do NOT write generic key anymore — prevents cross-account leak
  } catch {}
}

export async function connectErp(erpId, password) {
  const { data } = await apiClient.post("/erp/connect", { erp_id: erpId, password });
  if (data?.marks?.subjects) {
    saveCache({ subjects: data.marks.subjects, avg: data.marks.avg_percent, at: data.scraped_at });
  }
  return data;
}
export async function refreshErp() {
  const { data } = await apiClient.post("/erp/refresh");
  if (data?.marks?.subjects) {
    saveCache({ subjects: data.marks.subjects, avg: data.marks.avg_percent, at: data.scraped_at });
  }
  return data;
}
export async function getErpStatus() {
  const { data } = await apiClient.get("/erp/status");
  return data;
}
export async function getErpProfile() {
  const { data } = await apiClient.get("/erp/profile");
  return data;
}
export async function getErpMarks() {
  const { data } = await apiClient.get("/erp/marks");
  return data;
}
export function getCachedErpMarks() {
  try {
    const key = userCacheKey();
    if (key) {
      const v = localStorage.getItem(key);
      if (v) return JSON.parse(v);
      return null; // no fallback to generic when logged in — strict isolation
    }
    // not logged in — fallback to legacy generic for backward compat only
    return JSON.parse(localStorage.getItem("erp_marks_cache") || "null");
  } catch { return null; }
}
export function isErpConnected() {
  try { return !!getCachedErpMarks()?.subjects?.length; } catch { return false; }
}
export function clearErpCacheForCurrentUser() {
  try {
    const key = userCacheKey();
    if (key) localStorage.removeItem(key);
  } catch {}
}
