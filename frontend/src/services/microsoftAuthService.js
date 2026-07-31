import { apiClient } from "./api/apiClient";

export async function getMicrosoftAuthUrl() {
  return apiClient.get("/auth/microsoft/url");
}

export async function exchangeMicrosoftCode(code) {
  return apiClient.post("/auth/microsoft/callback", { code });
}

export async function getMicrosoftStatus() {
  return apiClient.get("/auth/microsoft/status");
}

export async function disconnectMicrosoft() {
  return apiClient.post("/auth/microsoft/logout");
}
