import { apiClient } from "./api/apiClient";

export async function updateOperational(
  rawContent
) {
  return apiClient.post(
    "/multiportal/operational/update",
    {
      rawContent,
    }
  );
}