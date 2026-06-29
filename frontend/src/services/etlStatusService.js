import { apiClient } from "./api/apiClient";

export async function getEtlStatus() {
  return apiClient.get("/etl/status");
}
