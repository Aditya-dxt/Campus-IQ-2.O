import { apiClient } from "./client";

export async function getStudentDashboard() {
  const { data } = await apiClient.get("/predict/dashboard");
  return data;
}

export async function getStudents() {
  const { data } = await apiClient.get("/predict/students");
  return data;
}

export async function getStudentById(studentId) {
  const { data } = await apiClient.get(`/predict/students/${studentId}`);
  return data;
}

export async function getCohortStats() {
  const { data } = await apiClient.get("/predict/cohort");
  return data;
}
