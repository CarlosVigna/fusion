import { apiClient } from "./api/apiClient";

export async function getInstallations(status) {
  const params = status ? `?status=${status}` : "";
  return apiClient.get(`/installations${params}`);
}

export async function getInstallationsPendingCount() {
  return apiClient.get("/installations/pending-count");
}

export async function getInstallationsDashboard() {
  return apiClient.get("/installations/dashboard");
}

export async function getInstallationReport({ search, status, startDate, endDate } = {}) {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (status) params.append("status", status);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const qs = params.toString();
  return apiClient.get(`/installations/report${qs ? `?${qs}` : ""}`);
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

export async function addInstallationObservation(id, text) {
  return apiClient.post(`/installations/${id}/observations`, { text });
}

export async function getInstallationObservations(id) {
  return apiClient.get(`/installations/${id}/observations`);
}

export async function dismissInstallationAlert(id) {
  return apiClient.post(`/installations/${id}/dismiss-alert`);
}
