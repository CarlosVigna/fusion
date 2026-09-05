import { apiClient } from "./api/apiClient";

export async function getLineCancels(status) {
  const query = status ? `?status=${status}` : "";
  return apiClient.get(`/line-cancels${query}`);
}

export async function syncLineCancels() {
  return apiClient.post("/line-cancels/sync");
}

export async function verifyLineCancel(id) {
  return apiClient.put(`/line-cancels/${id}/verify`);
}

export async function requestLineCancel(id) {
  return apiClient.put(`/line-cancels/${id}/request`);
}

export async function markLineCancelDone(id) {
  return apiClient.put(`/line-cancels/${id}/done`);
}

export async function setLineCancelDate(id, cancelledAt) {
  return apiClient.put(`/line-cancels/${id}/set-date`, { cancelledAt });
}

export async function generateLineCancelEmail(ids) {
  return apiClient.post("/line-cancels/email", { ids });
}
