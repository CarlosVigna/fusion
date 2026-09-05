import { apiClient } from "./api/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function getLineCancels(status) {
  const query = status ? `?status=${status}` : "";
  return apiClient.get(`/line-cancels${query}`);
}

export async function syncLineCancels() {
  return apiClient.post("/line-cancels/sync");
}

export async function verifyLineCancel(id) {
  return apiClient.put(`/line-cancels/${id}/verify`);
}

export async function requestLineCancel(id) {
  return apiClient.put(`/line-cancels/${id}/request`);
}

export async function markLineCancelDone(id) {
  return apiClient.put(`/line-cancels/${id}/done`);
}

export async function setLineCancelDate(id, cancelledAt) {
  return apiClient.put(`/line-cancels/${id}/set-date`, { cancelledAt });
}

export async function generateLineCancelEmail(ids) {
  return apiClient.post("/line-cancels/email", { ids });
}

// Fora do apiClient (que so' faz JSON) — precisa ler a resposta como
// blob binario, mesmo padrao ja usado em customReportService.js.
export async function exportLineCancels({ format, status, plate, dateFrom, dateTo }) {
  const token = localStorage.getItem("fusion_token");

  const params = new URLSearchParams({ format });
  if (status) params.set("status", status);
  if (plate) params.set("plate", plate);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const response = await fetch(`${API_BASE}/line-cancels/export?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (response.status === 401) {
    localStorage.removeItem("fusion_token");
    localStorage.removeItem("fusion_user");
    window.location.href = "/login";
    return;
  }

  if (!response.ok) {
    throw new Error("Erro ao exportar cancelamento de linhas");
  }

  const blob = await response.blob();

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : (format === "PDF" ? "cancelamento-linhas.pdf" : "cancelamento-linhas.xlsx");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
