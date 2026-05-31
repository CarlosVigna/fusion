import { apiClient } from "./api/apiClient";

export async function login(data) {
  return apiClient.post(
    "/auth/login",
    data
  );
}