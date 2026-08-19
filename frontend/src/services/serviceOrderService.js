import { apiClient } from "./api/apiClient";

export async function getServiceOrders() {
  return apiClient.get("/service-orders?includeCompleted=false");
}

export async function getCompletedServiceOrders() {
  return apiClient.get("/service-orders/completed");
}

export async function createServiceOrder(data) {
  return apiClient.post("/service-orders", data);
}

export async function updateServiceOrder(id, data) {
  return apiClient.put(`/service-orders/${id}`, data);
}

export async function updateScheduling(id, data) {
  return apiClient.put(`/service-orders/${id}/scheduling`, data);
}

export async function updateFinancialApproval(id, status) {
  return apiClient.put(`/service-orders/${id}/financial-approval`, { financialApprovalStatus: status });
}

export async function confirmCompletion(id) {
  return apiClient.put(`/service-orders/${id}/confirm-completion`, {});
}

export async function concludeLegacy(id) {
  return apiClient.post(`/service-orders/${id}/conclude-legacy`, {});
}

export async function getVehicleSignal(id) {
  return apiClient.get(`/service-orders/${id}/vehicle-signal`);
}

export async function deleteServiceOrder(id) {
  return apiClient.delete(`/service-orders/${id}`);
}

export async function getServiceOrderDashboard() {
  return apiClient.get("/service-orders/dashboard");
}

export async function getMonthlyClose(month) {
  return apiClient.get(`/service-orders/monthly-close?month=${month}`);
}

export function getMonthlyCloseExcelUrl(month) {
  return `/service-orders/monthly-close/excel?month=${month}`;
}

export function getMonthlyClosePdfUrl(month) {
  return `/service-orders/monthly-close/pdf?month=${month}`;
}

export async function getServiceOrderAuditLog(id) {
  return apiClient.get(`/service-orders/${id}/audit-log`);
}

export async function getFullAuditLog({ plate, action, performedBy, dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  if (plate)       params.append("plate", plate);
  if (action)      params.append("action", action);
  if (performedBy) params.append("performedBy", performedBy);
  if (dateFrom)    params.append("dateFrom", dateFrom);
  if (dateTo)      params.append("dateTo", dateTo);
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get(`/service-orders/audit-log${q}`);
}
