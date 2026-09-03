import { apiClient } from "./client";

export async function analyzeResume({ file, jobDescription }) {
  const form = new FormData();
  form.append("file", file);
  form.append("job_description", jobDescription);
  
  const { data } = await apiClient.post("/resume/score", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getResumeHistory() {
  const { data } = await apiClient.get("/resume/history");
  return data.history || [];
}
