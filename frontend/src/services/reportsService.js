import { apiClient } from "./api/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function getMultiportalSheet() {
  return apiClient.get("/reports/multiportal-sheet");
}

export async function downloadDeviceReport() {
  const token = localStorage.getItem("fusion_token");
  const response = await fetch(`${API_BASE}/reports/device-report/excel`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    localStorage.removeItem("fusion_token");
    localStorage.removeItem("fusion_user");
    window.location.href = "/login";
    return;
  }

  if (!response.ok) {
    throw new Error("Erro ao gerar relatório de dispositivos");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-dispositivos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
