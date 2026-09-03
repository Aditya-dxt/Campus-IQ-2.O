import { apiClient } from "./client";

export async function getWeekSchedule() {
  // Since the UI doesn't have a form for this yet, we send a default payload
  // representing a typical student schedule request.
  const payload = {
    weak_subjects: { "Data Structures": 45, "Algorithms": 60 },
    deadlines: [
      { subject: "Data Structures", task: "Midterm", days_until_due: 3 },
      { subject: "Algorithms", task: "Assignment 4", days_until_due: 5 }
    ],
    available_hours: {
      Monday: 2, Tuesday: 3, Wednesday: 2, Thursday: 3, Friday: 1
    }
  };
  
  const { data } = await apiClient.post("/schedule/generate", payload);
  // data.plan is { "Monday": ["task1"], "Tuesday": ["task2"] }
  // The frontend MOCK_WEEK_SCHEDULE expects an array: [{ day, tasks: [] }]
  // Let's adapt it here to avoid breaking the UI.
  
  const formattedPlan = Object.entries(data.plan).map(([day, tasks]) => ({
    id: `day-${day}`,
    day,
    tasks: tasks.map((t, i) => ({
      id: `task-${day}-${i}`,
      title: t,
      type: "study",
      duration: "1h"
    }))
  }));
  
  return formattedPlan;
}
