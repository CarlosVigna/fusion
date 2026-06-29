import { apiClient } from "./api/apiClient";

export async function getActiveSignalReturnAlerts() {
  return apiClient.get("/alerts/signal-return");
}

export async function dismissSignalReturnAlert(id) {
  return apiClient.post(`/alerts/signal-return/${id}/dismiss`);
}

export async function markSignalReturnAlertAsBaixa(id) {
  return apiClient.post(`/alerts/signal-return/${id}/baixa`);
}
