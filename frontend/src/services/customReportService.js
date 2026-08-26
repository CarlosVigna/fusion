import { apiClient } from "./api/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function countCustomReport(payload) {
  return apiClient.post("/reports/custom/count", payload);
}

export async function downloadCustomReport(payload) {
  const token = localStorage.getItem("fusion_token");

  const response = await fetch(`${API_BASE}/reports/custom`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    localStorage.removeItem("fusion_token");
    localStorage.removeItem("fusion_user");
    window.location.href = "/login";
    return;
  }

  if (!response.ok) {
    throw new Error("Erro ao gerar relatório");
  }

  const blob = await response.blob();

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : (payload.format === "PDF" ? "relatorio.pdf" : "relatorio.xlsx");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
