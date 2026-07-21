import { apiClient } from "./api/apiClient";

export const getUsers    = ()         => apiClient.get("/users").then(r => r.data);
export const createUser  = (data)     => apiClient.post("/users", data).then(r => r.data);
export const updateUser  = (id, data) => apiClient.put(`/users/${id}`, data).then(r => r.data);
export const deactivateUser = (id)    => apiClient.delete(`/users/${id}`);
