import { apiClient } from "./api/apiClient";

export async function getOperationalGrid(
  filters = {}
) {

  const params =
    new URLSearchParams();

  if (filters.plate) {

    params.append(
      "plate",
      filters.plate
    );

  }

  if (filters.status) {

    params.append(
      "status",
      filters.status
    );

  }

  if (filters.includeKako) {

    params.append(
      "includeKako",
      "true"
    );

  }

  const query =
    params.toString();

  return apiClient.get(

    `/vehicles/grid${
      query
        ? `?${query}`
        : ""
    }`

  );

}