import { apiClient } from "./api/apiClient";

export async function login(data) {
  return apiClient.post(
    "/auth/login",
    data
  );
}

export async function getMe() {
  return apiClient.get("/auth/me");
}

export async function updateProfile(data) {
  return apiClient.put("/auth/me", data);
}

export async function changePassword(data) {
  return apiClient.put("/auth/me/password", data);
}