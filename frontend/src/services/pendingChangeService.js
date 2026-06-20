import { apiClient } from "./api/apiClient";

export async function getPendingChanges() {
  return apiClient.get("/pending-changes");
}

export async function approveChange(id) {
  return apiClient.post(`/pending-changes/${id}/approve`);
}

export async function rejectChange(id) {
  return apiClient.post(`/pending-changes/${id}/reject`);
}
