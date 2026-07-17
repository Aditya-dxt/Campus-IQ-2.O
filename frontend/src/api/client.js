import axios from "axios";

export const MOCK_DELAY_MS = 450;

export const delay = (ms = MOCK_DELAY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Set VITE_USE_MOCKS=false in .env to call the real FastAPI backend. */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("campusiq_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Future pattern for real API calls:
 *   const { data } = await apiClient.post("/auth/login", body);
 *   return data;
 */
export async function mockOrFetch({ mockFn, requestFn }) {
  if (USE_MOCKS) {
    return mockFn();
  }
  return requestFn();
}
