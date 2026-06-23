import { apiClient } from "./api/apiClient";

export async function getMaintenanceRecords(includeClosed = false) {
  const query = includeClosed ? "?status=ALL" : "";
  return apiClient.get(`/maintenance${query}`);
}

export async function createMaintenanceRecord(data) {
  return apiClient.post("/maintenance", data);
}

export async function updateMaintenanceRecord(id, data) {
  return apiClient.put(`/maintenance/${id}`, data);
}

export async function closeMaintenanceRecord(id) {
  return apiClient.put(`/maintenance/${id}/close`);
}

export async function deleteMaintenanceRecord(id) {
  return apiClient.delete(`/maintenance/${id}`);
}
