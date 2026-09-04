import { apiClient } from "./client";

export async function login({ email, password }) {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
}

export async function signup({ name, email, password, confirm_password, role, branch, erp_id, erp_password, coordinator_section }) {
  const payload = { name, email, password, role, branch };
  if (confirm_password) payload.confirm_password = confirm_password;
  if (role === "student") {
    payload.erp_id = erp_id;
    payload.erp_password = erp_password;
  }
  if (role === "mentor") {
    payload.coordinator_section = coordinator_section;
  }
  const { data } = await apiClient.post("/auth/signup", payload);
  return data;
}

export async function getProfile() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}
