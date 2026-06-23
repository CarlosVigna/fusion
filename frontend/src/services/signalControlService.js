import { apiClient } from "./api/apiClient";

export async function getSignalControl() {
  return apiClient.get("/vehicles/signal-control");
}

export async function getNeverCommunicated() {
  return apiClient.get("/vehicles/never-communicated");
}
