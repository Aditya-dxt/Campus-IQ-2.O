import { apiClient } from "./client";

const DAY_SHORT = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };
const SHORT_TO_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

export async function generateSchedule(payload) {
  const { data } = await apiClient.post("/schedule/generate", payload);
  return data; // { plan, detailed_plan, total_study_hours }
}

export function detailedPlanToBlocks(detailedPlan) {
  // detailedPlan: { Monday: [ {subject, task, reason, reason_label, start, end} ], ... }
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
        reason: it.reason, // "deadline" | "weak" | "placement"
        reason_label: it.reason_label,
        focus: it.focus,
        score: it.score,
      });
    }
  }
  return blocks;
}

// Legacy helper kept for old callers — now uses detailed_plan if available
export async function getWeekSchedule() {
  const payload = {
    weak_subjects: { "Data Structures": 45, "Algorithms": 60, "DBMS": 72 },
    deadlines: [
      { subject: "Data Structures", task: "Midterm", days_until_due: 3 },
      { subject: "DBMS", task: "Lab Viva", days_until_due: 2 },
    ],
    available_hours: { Monday: 2, Tuesday: 2, Wednesday: 2, Thursday: 2, Friday: 1, Saturday: 0, Sunday: 0 },
  };
  const data = await generateSchedule(payload);
  if (data.detailed_plan) return detailedPlanToBlocks(data.detailed_plan);
  // fallback to legacy string plan
  const blocks = [];
  let id = 0;
  for (const [fullDay, tasks] of Object.entries(data.plan || {})) {
    const short = DAY_SHORT[fullDay] || fullDay.slice(0, 3);
    for (const t of tasks) {
      const m = t.match(/1 Hour: (.+?) \((.+?)\)/);
      const subject = m ? m[1] : t;
      blocks.push({ id: `b-${id++}`, day: short, fullDay, title: subject, subject, task: m?.[2] || "", start: "18:00", end: "19:00", reason: "weak", reason_label: m?.[2] || "" });
    }
  }
  return blocks;
}

export { SHORT_TO_FULL, DAY_SHORT };
