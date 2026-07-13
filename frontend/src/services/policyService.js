import { apiClient } from "./api/apiClient";

export async function getPolicies({ plate, status } = {}) {
  const params = new URLSearchParams();
  if (plate) params.append("plate", plate);
  if (status) params.append("status", status);
  const qs = params.toString();
  return apiClient.get(`/policies${qs ? `?${qs}` : ""}`);
}

export async function getPendingVehicles() {
  return apiClient.get("/policies/pending-vehicles");
}

export async function fetchPolicyFromPortal(plate) {
  return apiClient.post(`/policies/fetch?plate=${encodeURIComponent(plate)}`);
}

export async function getExpiringPolicies(days = 30) {
  return apiClient.get(`/policies/expiring?days=${days}`);
}

export async function getExpiredPolicies() {
  return apiClient.get("/policies/expired");
}

export async function getPolicyBadgeCounts() {
  return apiClient.get("/policies/badge-counts");
}

export async function createPolicy(data) {
  return apiClient.post("/policies", data);
}

export async function updatePolicy(id, data) {
  return apiClient.put(`/policies/${id}`, data);
}

export async function deletePolicy(id) {
  return apiClient.delete(`/policies/${id}`);
}

export async function getPolicyReport(type) {
  return apiClient.get(`/policies/report?type=${type}`);
}

export async function startVerification() {
  return apiClient.post("/policies/verify-all");
}

export async function getVerificationStatus(jobId) {
  return apiClient.get(`/policies/verify-status/${jobId}`);
}
