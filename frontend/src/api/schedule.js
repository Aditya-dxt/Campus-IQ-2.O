import { apiClient } from "./client";

const DAY_SHORT = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };
const SHORT_TO_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

export async function generateSchedule(payload) {
  const { data } = await apiClient.post("/schedule/generate", payload);
  return data; // { plan, detailed_plan, total_study_hours }
}

export function detailedPlanToBlocks(detailedPlan) {
  const blocks = [];
  let id = 0;
  for (const [fullDay, items] of Object.entries(detailedPlan || {})) {
    const short = DAY_SHORT[fullDay] || fullDay.slice(0, 3);
    for (const it of items) {
      blocks.push({
        id: `b-${id++}`,
        day: short,
        fullDay,
        subject: it.subject,
        title: it.subject,
        task: it.task,
        start: it.start,
        end: it.end,
        duration: it.duration || "1h",
        reason: it.reason,
        reason_label: it.reason_label,
        focus: it.focus,
        score: it.score,
      });
    }
  }
  return blocks;
}

// No mock fallback — callers must supply real payload via generateSchedule.
// Kept for backward compat but returns empty unless payload provided.
export async function getWeekSchedule() {
  // Authentic: no prefilled demo data. Return empty so UI shows empty state.
  return [];
}

export { SHORT_TO_FULL, DAY_SHORT };
