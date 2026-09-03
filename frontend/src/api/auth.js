import { apiClient } from "./client";

export async function login({ email, password }) {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
}

export async function signup({ name, email, password, role, branch }) {
  const { data } = await apiClient.post("/auth/signup", {
    name,
    email,
    password,
    role,
    branch,
  });
  return data;
}

export async function getProfile() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}
