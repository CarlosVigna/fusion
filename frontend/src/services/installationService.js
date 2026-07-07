import { apiClient } from "./api/apiClient";

export async function getInstallations(status) {
  const params = status ? `?status=${status}` : "";
  return apiClient.get(`/installations${params}`);
}

export async function getInstallationsPendingCount() {
  return apiClient.get("/installations/pending-count");
}

export async function markInstallationSent(id) {
  return apiClient.put(`/installations/${id}/sent`);
}

export async function cancelInstallation(id) {
  return apiClient.put(`/installations/${id}/cancel`);
}

export async function deleteInstallation(id) {
  return apiClient.delete(`/installations/${id}`);
}
