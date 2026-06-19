import { apiClient } from "./api/apiClient";

export async function getImportHistory() {
  return apiClient.get("/audit/imports");
}