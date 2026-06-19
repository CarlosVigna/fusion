import { apiClient } from "./api/apiClient";

export async function getLastSync(type) {

  const query = type ? `?type=${type}` : "";

  return apiClient.get(`/imports/last-sync${query}`);

}

export async function triggerImport(type) {

  const query = type ? `?type=${type}` : "";

  return apiClient.post(`/imports/trigger${query}`);

}
