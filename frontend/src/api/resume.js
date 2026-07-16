import { apiClient, delay, mockOrFetch } from "./client";
import { MOCK_RESUME_HISTORY, MOCK_RESUME_RESULT } from "../mocks/mockData";

export async function analyzeResume({ jobDescription }) {
  return mockOrFetch({
    mockFn: async () => {
      await delay(800);
      if (!jobDescription?.trim()) {
        const err = new Error("Job description is required");
        err.status = 400;
        throw err;
      }
      return { ...MOCK_RESUME_RESULT };
    },
    requestFn: async () => {
      const form = new FormData();
      form.append("job_description", jobDescription);
      const { data } = await apiClient.post("/resume/analyze", form);
      return data;
    },
  });
}

export async function getResumeHistory() {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      return [...MOCK_RESUME_HISTORY];
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/resume/history");
      return data;
    },
  });
}
