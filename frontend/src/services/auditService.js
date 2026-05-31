import { apiClient } from "./api/apiClient";

export async function getImportHistory() {
  return apiFetch("/audit/imports");
}