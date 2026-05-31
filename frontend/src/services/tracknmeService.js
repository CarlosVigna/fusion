import { apiClient } from "./api/apiClient";

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