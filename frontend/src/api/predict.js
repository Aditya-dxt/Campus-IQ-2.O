import { apiClient, delay, mockOrFetch } from "./client";
import {
  MOCK_COHORT_STATS,
  MOCK_STUDENT_SUMMARY,
  MOCK_STUDENTS,
} from "../mocks/mockData";

export async function getStudentDashboard() {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      return { ...MOCK_STUDENT_SUMMARY };
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/predict/dashboard");
      return data;
    },
  });
}

export async function getStudents() {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      return [...MOCK_STUDENTS];
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/predict/students");
      return data;
    },
  });
}

export async function getStudentById(studentId) {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      const student = MOCK_STUDENTS.find((s) => s.id === studentId);
      if (!student) {
        const err = new Error("Student not found");
        err.status = 404;
        throw err;
      }
      return { ...student };
    },
    requestFn: async () => {
      const { data } = await apiClient.get(`/predict/students/${studentId}`);
      return data;
    },
  });
}

export async function getCohortStats() {
  return mockOrFetch({
    mockFn: async () => {
      await delay();
      return { ...MOCK_COHORT_STATS };
    },
    requestFn: async () => {
      const { data } = await apiClient.get("/predict/cohort");
      return data;
    },
  });
}
