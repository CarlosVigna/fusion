import { apiClient } from "./api/apiClient";

export async function getLetters() {
  return apiClient.get("/letters");
}

export async function createLetter(data) {
  return apiClient.post("/letters", data);
}

export async function updateLetter(id, data) {
  return apiClient.put(`/letters/${id}`, data);
}

export async function deleteLetter(id) {
  return apiClient.delete(`/letters/${id}`);
}
