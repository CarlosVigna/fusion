import { apiClient } from "./api/apiClient";

export async function getDashboard() {

  return apiClient.get(
    "/dashboard"
  );

}