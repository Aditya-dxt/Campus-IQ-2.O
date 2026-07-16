import { apiClient, delay, mockOrFetch } from "./client";
import { INTERVENTION_ACTIONS, MOCK_INTERVENTIONS } from "../mocks/mockData";

const interventionsStore = { ...MOCK_INTERVENTIONS };

export async function getInterventions(studentId) {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      return [...(interventionsStore[studentId] || [])];
    },
    requestFn: async () => {
      const { data } = await apiClient.get(`/intervention/${studentId}`);
      return data;
    },
  });
}

export async function getInterventionActions() {
  return mockOrFetch({
    mockFn: async () => {
      await delay(200);
      return [...INTERVENTION_ACTIONS];
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/intervention/actions");
      return data;
    },
  });
}

export async function createIntervention({ studentId, action, actionNote, riskBefore }) {
  return mockOrFetch({
    mockFn: async () => {
      await delay(500);
      const reviewDate = new Date();
      reviewDate.setDate(reviewDate.getDate() + 14);
      const entry = {
        id: `int-${Date.now()}`,
        action,
        actionNote,
        riskBefore,
        riskAfter: Math.max(0, riskBefore - 0.07),
        reviewDate: reviewDate.toISOString().slice(0, 10),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      interventionsStore[studentId] = [
        entry,
        ...(interventionsStore[studentId] || []),
      ];
      return entry;
    },
    requestFn: async () => {
      const { data } = await apiClient.post("/intervention", {
        student_id: studentId,
        action,
        action_note: actionNote,
        risk_before: riskBefore,
      });
      return data;
    },
  });
}
