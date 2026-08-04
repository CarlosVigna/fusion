import { apiClient } from "./api/apiClient";

export async function getTechnicians() {
  return apiClient.get("/technicians");
}

export async function createTechnician(data) {
  return apiClient.post("/technicians", data);
}

export async function updateTechnician(id, data) {
  return apiClient.put(`/technicians/${id}`, data);
}

export async function deleteTechnician(id) {
  return apiClient.delete(`/technicians/${id}`);
}
