import { apiClient } from "./api/apiClient";

export async function getMultiportalSheet() {
  return apiClient.get("/reports/multiportal-sheet");
}
