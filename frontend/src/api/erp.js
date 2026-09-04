import { apiClient } from "./client";

function userCacheKey() {
  try {
    const u = JSON.parse(localStorage.getItem("campusiq_user") || "null");
    if (u?.id) return `erp_marks_cache_${u.id}`;
  } catch {}
  return "erp_marks_cache";
}

function saveCache(payload) {
  try {
    const key = userCacheKey();
    localStorage.setItem(key, JSON.stringify(payload));
    // keep legacy key for backward compat
    localStorage.setItem("erp_marks_cache", JSON.stringify(payload));
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
    const v = localStorage.getItem(key);
    if (v) return JSON.parse(v);
    return JSON.parse(localStorage.getItem("erp_marks_cache") || "null");
  } catch { return null; }
}
export function isErpConnected() {
  try { return !!getCachedErpMarks()?.subjects?.length; } catch { return false; }
}
