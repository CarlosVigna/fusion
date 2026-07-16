import { apiClient } from "./api/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function startAnalysis({ plate, startDate, endDate }) {
  return apiClient.post("/sinistro/start", { plate, startDate, endDate });
}

export async function getAnalysisStatus(id) {
  return apiClient.get(`/sinistro/${id}/status`);
}

export async function getAnalysisHistory() {
  return apiClient.get("/sinistro/history");
}

// Downloads binários (PDF/Excel/ZIP) não passam pelo apiClient — ele
// sempre espera um corpo JSON. Replica só o cabeçalho de auth aqui.
async function downloadFile(endpoint, filename) {
  const token = localStorage.getItem("fusion_token");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error("Falha ao baixar arquivo (HTTP " + response.status + ")");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadReport(id, plate, format) {
  return downloadFile(
    `/sinistro/${id}/download-report?format=${format}`,
    `relatorio-sinistro-${plate}.${format === "pdf" ? "pdf" : "xlsx"}`
  );
}

export async function downloadPack(id, plate) {
  return downloadFile(`/sinistro/${id}/download-pack`, `sinistro-${plate}-pack.zip`);
}
