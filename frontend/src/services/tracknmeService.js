import { apiClient } from "./api/apiClient";

export async function getTracknMeHistory({ dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  if (dateFrom) params.append("dateFrom", dateFrom);
  if (dateTo) params.append("dateTo", dateTo);
  const query = params.toString() ? `?${params}` : "";
  return apiClient.get(`/tracknme/history${query}`);
}

export async function previewTracknMe(
  file
) {
  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  return apiClient.post(
    "/tracknme/preview",
    formData
  );
}

export async function confirmTracknMe(
  items
) {
  return apiClient.post(
    "/tracknme/confirm",
    {
      items,
    }
  );
}