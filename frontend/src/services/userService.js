import { apiClient } from "./api/apiClient";

export const getUsers       = ()         => apiClient.get("/users");
export const createUser     = (data)     => apiClient.post("/users", data);
export const updateUser     = (id, data) => apiClient.put(`/users/${id}`, data);
export const deactivateUser = (id)       => apiClient.delete(`/users/${id}`);
