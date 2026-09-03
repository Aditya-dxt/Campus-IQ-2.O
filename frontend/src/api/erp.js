import { apiClient } from "./client";

export async function connectErp(erpId, password) {
  const { data } = await apiClient.post("/erp/connect", { erp_id: erpId, password });
  // cache per-subject marks for dashboard/schedule reuse without re-entering password
  if (data?.marks?.subjects) {
    try { localStorage.setItem("erp_marks_cache", JSON.stringify({ subjects: data.marks.subjects, avg: data.marks.avg_percent, at: data.scraped_at })); } catch {}
  }
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
  try { return JSON.parse(localStorage.getItem("erp_marks_cache") || "null"); } catch { return null; }
}
