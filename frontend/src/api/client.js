import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  headers: { 
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true" 
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("campusiq_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we get a 401 on the login route itself, don't force a reload, just return the error to the component.
    if (
      error.response &&
      error.response.status === 401 &&
      !error.config.url.includes("/auth/login")
    ) {
      localStorage.removeItem("campusiq_token");
      localStorage.removeItem("campusiq_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
