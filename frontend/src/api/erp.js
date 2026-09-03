import { apiClient } from "./client";

export async function connectErp(erpId, password) {
  const { data } = await apiClient.post("/erp/connect", { erp_id: erpId, password });
  return data;
}

export async function getErpProfile() {
  const { data } = await apiClient.get("/erp/profile");
  return data;
}
