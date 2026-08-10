import { apiClient } from "./api/apiClient";

export async function getRecentImportDiffs() {
  return apiClient.get("/imports/diff/recent");
}

export async function dismissImportDiff(id) {
  return apiClient.post(`/imports/diff/${id}/dismiss`);
}

export async function getLastSync(type) {

  const query = type ? `?type=${type}` : "";

  return apiClient.get(`/imports/last-sync${query}`);

}

export async function triggerImport(type, { timeoutMs = 120000 } = {}) {

  const query = type ? `?type=${type}` : "";

  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {

    return await apiClient.post(
      `/imports/trigger${query}`,
      undefined,
      { signal: controller.signal }
    );

  } finally {

    clearTimeout(timeoutId);

  }

}
