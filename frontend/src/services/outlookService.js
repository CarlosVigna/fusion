import { apiClient } from "./api/apiClient";

export async function createShiftHandoverDraft(request) {
  return apiClient.post("/outlook/draft/passagem-turno", request);
}

export async function previewShiftHandover(request) {
  return apiClient.post("/outlook/draft/passagem-turno/preview", request);
}

export async function saveSignature(signatureHtml) {
  return apiClient.put("/auth/me/signature", { signatureHtml });
}
