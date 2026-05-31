import { apiClient } from "./api/apiClient";

export async function previewMultiportalDevice(
  file
) {
  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  return apiClient.post(
    "/multiportal/device/preview",
    formData
  );
}

export async function confirmMultiportalDevice(
  items
) {
  return apiClient.post(
    "/multiportal/device/confirm",
    {
      items,
    }
  );
}