import { apiClient } from "./api/apiClient";

export async function getSignalControl(includeKako = false) {
  const query = includeKako ? "?includeKako=true" : "";
  return apiClient.get(`/vehicles/signal-control${query}`);
}

export async function getNeverCommunicated() {
  return apiClient.get("/vehicles/never-communicated");
}
