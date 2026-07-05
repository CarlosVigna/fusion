import { apiClient } from "./api/apiClient";

export async function getLetters(includeArchived = false) {
  const query = includeArchived ? "?status=ALL" : "";
  return apiClient.get(`/letters${query}`);
}

export async function getLettersPendingBaixa() {
  return apiClient.get("/letters/pending-baixa");
}

export async function createLetter(data) {
  return apiClient.post("/letters", data);
}

export async function updateLetter(id, data) {
  return apiClient.put(`/letters/${id}`, data);
}

export async function baixarLetter(id) {
  return apiClient.put(`/letters/${id}/baixar`);
}

export async function deleteLetter(id) {
  return apiClient.delete(`/letters/${id}`);
}
