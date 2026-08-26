import { apiClient } from "./api/apiClient";

export async function startPortalSync() {
  return apiClient.post("/vehicles/sync-portal", {});
}

export async function getPortalSyncStatus(jobId) {
  return apiClient.get(`/vehicles/sync-portal/status/${jobId}`);
}

export async function getPortalSyncDiffs() {
  return apiClient.get("/vehicles/sync-portal/diffs");
}

export async function acceptPortalDiff(id) {
  return apiClient.put(`/vehicles/sync-portal/diffs/${id}/accept`, {});
}

export async function rejectPortalDiff(id) {
  return apiClient.put(`/vehicles/sync-portal/diffs/${id}/reject`, {});
}

export async function acceptAllPortalDiffs() {
  return apiClient.put("/vehicles/sync-portal/diffs/accept-all", {});
}
