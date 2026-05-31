import { apiClient } from "./api/apiClient";

export async function getVehicles() {
  return apiClient.get(
    "/vehicles"
  );
}

export async function getVehicleByPlate(
  plate
) {
  return apiClient.get(
    `/vehicles/${plate}`
  );
}

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

  const query =
    params.toString();

  return apiClient.get(
    `/vehicles/grid${
      query ? `?${query}` : ""
    }`
  );
}