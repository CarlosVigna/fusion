import { apiClient } from "./api/apiClient";

export async function getObservationHistory(plate) {
  return apiClient.get(`/observations/vehicle/${plate}`);
}

export async function createObservation(plate, text) {
  return apiClient.post(`/observations/vehicle/${plate}`, { text });
}

export async function checkObservation(id) {
  return apiClient.post(`/observations/${id}/check`);
}

export async function getLatestObservations() {
  return apiClient.get("/observations/latest");
}
