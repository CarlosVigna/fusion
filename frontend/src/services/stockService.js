import { apiClient } from "./api/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function getAllStock() {
  return apiClient.get("/stock");
}

export async function getStockByTechnician(technicianId) {
  return apiClient.get(`/stock/technician/${technicianId}`);
}

export async function addToStock(technicianId, data) {
  return apiClient.post(`/stock/technician/${technicianId}`, data);
}

export async function confirmInstallation(stockId, data) {
  return apiClient.put(`/stock/${stockId}/confirm`, data);
}

export async function markStockAsReturned(stockId) {
  return apiClient.put(`/stock/${stockId}/return`, {});
}

export async function getPendingConfirmations() {
  return apiClient.get("/stock/pending-confirmation");
}

export async function ignorePendingConfirmation(id) {
  return apiClient.put(`/stock/pending-confirmation/${id}/ignore`, {});
}

export async function downloadStockExcel() {
  const token = localStorage.getItem("fusion_token");
  const response = await fetch(`${API_BASE}/stock/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    localStorage.removeItem("fusion_token");
    localStorage.removeItem("fusion_user");
    window.location.href = "/login";
    return;
  }

  if (!response.ok) {
    throw new Error("Erro ao gerar relatório de estoque");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `estoque-equipamentos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
