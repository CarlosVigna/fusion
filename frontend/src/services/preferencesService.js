import { apiClient } from "./api/apiClient";

export async function getPreference(key) {
  const response = await apiClient.get(`/preferences/${key}`);
  return response?.value ?? null;
}

export async function savePreference(key, value) {
  const response = await apiClient.put(`/preferences/${key}`, { value });
  return response?.value ?? null;
}
