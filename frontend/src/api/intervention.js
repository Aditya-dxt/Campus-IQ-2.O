import { apiClient } from "./client";

export async function getInterventions(studentId) {
  const { data } = await apiClient.get(`/intervention/list?student_id=${studentId}`);
  return data.interventions.map((intv) => ({
    id: intv.id,
    action: (()=>{ const m=intv.action_note.match(/^\[(.*?)\]/); return m?m[1]:"Custom"; })(),
    actionNote: intv.action_note.replace(/^\[.*?\]\s*/,""),
    rawNote: intv.action_note,
    riskBefore: intv.risk_before,
    riskAfter: intv.risk_after,
    reviewDate: intv.review_date,
    createdAt: intv.created_at,
  }));
}

export async function getInterventionActions() {
  return [
    { id: "academic_tutoring", label: "Academic Tutoring Session" },
    { id: "counseling", label: "Counseling / Wellness Check" },
    { id: "schedule_adjustment", label: "Schedule Adjustment" },
    { id: "peer_mentoring", label: "Assign Peer Mentor" },
    { id: "other", label: "Other (Specify in notes)" },
  ];
}

export async function createIntervention({ studentId, action, actionNote, riskBefore, reviewDate }) {
  if (!reviewDate) {
    const d = new Date(); d.setDate(d.getDate() + 14);
    reviewDate = d.toISOString().slice(0, 10);
  }
  const { data } = await apiClient.post("/intervention/create", {
    student_id: studentId,
    action_note: `[${action}] ${actionNote}`,
    review_date: reviewDate,
  });
  const intv = data.intervention;
  return {
    id: intv.id,
    action: action,
    actionNote: intv.action_note.replace(/^\[.*?\]\s*/,""),
    rawNote: intv.action_note,
    riskBefore: intv.risk_before,
    riskAfter: intv.risk_after,
    reviewDate: intv.review_date,
    createdAt: intv.created_at,
  };
}

export async function reviewIntervention(interventionId) {
  const { data } = await apiClient.post("/intervention/review", { intervention_id: interventionId });
  return data;
}
