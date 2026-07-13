import { useEffect, useMemo, useRef, useState } from "react";

import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { CheckCircle2, AlertTriangle, XCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import {
  createPolicy,
  deletePolicy,
  fetchPolicyFromPortal,
  getPendingVehicles,
  getPolicies,
  getPolicyReport,
  getVerificationStatus,
  startVerification,
  updatePolicy,
} from "../services/policyService";

import { formatLocalDate } from "../utils/dateUtils";

const EMPTY_FORM = {
  policyNumber: "",
  startDate: "",
  endDate: "",
  insuredName: "",
  cpfCnpj: "",
  vehicleModel: "",
  vehicleBrand: "",
  bonus: "",
  statusDescricao: "",
};

const REPORT_TYPES = [
  { key: "NO_POLICY",       label: "Sem apólice" },
  { key: "EXPIRING_TODAY",  label: "Vencendo hoje" },
  { key: "EXPIRING_WEEK",   label: "Vencendo esta semana" },
  { key: "EXPIRING_MONTH",  label: "Vencendo em 30 dias" },
  { key: "EXPIRED",         label: "Vencidas" },
];

const REPORT_STATUS_LABEL = {
  ACTIVE:      "Ativa",
  EXPIRING:    "Vencendo",
  FUTURE:      "Futura",
  EXPIRED:     "Vencida",
  CANCELLED:   "Cancelada",
  SEM_APOLICE: "Sem Apólice",
};

const REPORT_STATUS_CLASS = {
  ACTIVE:      "bg-green-500/15 text-green-400",
  EXPIRING:    "bg-yellow-500/15 text-yellow-400",
  FUTURE:      "bg-blue-500/15 text-blue-400",
  EXPIRED:     "bg-red-500/15 text-red-400",
  CANCELLED:   "bg-zinc-700/40 text-zinc-400",
  SEM_APOLICE: "bg-zinc-700/40 text-zinc-400",
};

function daysRemaining(endDate) {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${endDate}T00:00:00`) - today) / 86400000);
}

function daysLabel(days) {
  if (days === null) return "--";
  if (days < 0) return "Vencida";
  if (days === 0) return "Vence hoje";
  return `${days} dia${days !== 1 ? "s" : ""}`;
}

function daysBadgeClass(days) {
  if (days === null) return "bg-zinc-700/40 text-zinc-400";
  if (days < 0) return "bg-red-500/15 text-red-400";
  if (days <= 30) return "bg-yellow-500/15 text-yellow-400";
  return "bg-green-500/15 text-green-400";
}

const STATUS_LABEL = {
  ACTIVE: "Ativa",
  EXPIRING: "Vencendo",
  FUTURE: "Futura",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
  SUPERSEDED: "Substituída",
};

const STATUS_CLASS = {
  ACTIVE: "bg-green-500/15 text-green-400",
  EXPIRING: "bg-yellow-500/15 text-yellow-400",
  FUTURE: "bg-blue-500/15 text-blue-400",
  EXPIRED: "bg-red-500/15 text-red-400",
  CANCELLED: "bg-zinc-700/40 text-zinc-400",
  SUPERSEDED: "bg-zinc-700/40 text-zinc-400",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_CLASS[status] || "bg-zinc-700/40 text-zinc-400"
      }`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function PortalStatusBadge({ status }) {
  if (!status) return <span className="text-zinc-500 text-sm">--</span>;
  const lower = status.toLowerCase();
  let cls = "bg-zinc-700/40 text-zinc-400";
  if (lower.includes("vigente"))   cls = "bg-green-500/15 text-green-400";
  else if (lower.includes("cancel")) cls = "bg-red-500/15 text-red-400";
  else if (lower.includes("futura")) cls = "bg-blue-500/15 text-blue-400";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ---------- Export helpers ----------

async function exportExcel(rows, reportLabel) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(reportLabel);

  ws.addRow(["Placa", "Segurado", "Apólice", "Fim Vigência", "Dias Restantes", "Status"]);
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow([
      r.plate || "",
      r.insuredName || "",
      r.policyNumber || "",
      r.endDate ? formatLocalDate(r.endDate) : "",
      r.daysRemaining != null ? r.daysRemaining : "",
      REPORT_STATUS_LABEL[r.statusLabel] || r.statusLabel || "",
    ]);
  }

  ws.columns.forEach((col) => { col.width = 22; });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `apolices-${reportLabel.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(rows, reportLabel) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(13);
  doc.text(`Relatório de Apólices — ${reportLabel}`, 14, 16);

  autoTable(doc, {
    startY: 22,
    head: [["Placa", "Segurado", "Apólice", "Fim Vigência", "Dias Restantes", "Status"]],
    body: rows.map((r) => [
      r.plate || "",
      r.insuredName || "",
      r.policyNumber || "",
      r.endDate ? formatLocalDate(r.endDate) : "",
      r.daysRemaining != null ? String(r.daysRemaining) : "",
      REPORT_STATUS_LABEL[r.statusLabel] || r.statusLabel || "",
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
  });

  doc.save(`apolices-${reportLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

// ---------- Main component ----------

export default function Policies() {

  const [tab, setTab] = useState("pending");
  const [policies, setPolicies] = useState([]);
  const [pendingVehicles, setPendingVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState(null);
  const [modalPlate, setModalPlate] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Buscar no Portal
  const [fetchingPlate, setFetchingPlate] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  // Relatórios
  const [reportType, setReportType] = useState("NO_POLICY");
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Conferir com Portal
  const [verifying, setVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(null); // { processed, total }
  const [verifyModal, setVerifyModal] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    loadData();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pol, pend] = await Promise.all([getPolicies(), getPendingVehicles()]);
      setPolicies(pol);
      setPendingVehicles(pend);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar apólices");
    } finally {
      setLoading(false);
    }
  }

  const activePolicies = useMemo(
    () =>
      policies
        .filter((p) => p.status === "ACTIVE" || p.status === "FUTURE" || p.status === "EXPIRING")
        .sort((a, b) => {
          if (!a.endDate) return 1;
          if (!b.endDate) return -1;
          return a.endDate.localeCompare(b.endDate);
        }),
    [policies]
  );

  const historyPolicies = useMemo(
    () => policies.filter(
      (p) => p.status === "EXPIRED" || p.status === "CANCELLED" || p.status === "SUPERSEDED"
    ),
    [policies]
  );

  function openCreateModal(vehicle) {
    setEditPolicy(null);
    setModalPlate(vehicle.plate);
    setForm({ ...EMPTY_FORM, insuredName: vehicle.insuredName || "" });
    setModalOpen(true);
  }

  function openEditModal(policy) {
    setEditPolicy(policy);
    setModalPlate(policy.plate);
    setForm({
      policyNumber:    policy.policyNumber    || "",
      startDate:       policy.startDate       || "",
      endDate:         policy.endDate         || "",
      insuredName:     policy.insuredName     || "",
      cpfCnpj:         policy.cpfCnpj         || "",
      vehicleModel:    policy.vehicleModel    || "",
      vehicleBrand:    policy.vehicleBrand    || "",
      bonus:           policy.bonus != null   ? String(policy.bonus) : "",
      statusDescricao: policy.statusDescricao || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditPolicy(null);
    setModalPlate("");
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, bonus: form.bonus !== "" ? Number(form.bonus) : null };
      if (editPolicy) {
        await updatePolicy(editPolicy.id, { ...payload, plate: editPolicy.plate });
        toast.success("Apólice atualizada");
      } else {
        await createPolicy({ ...payload, plate: modalPlate, source: "MANUAL" });
        toast.success("Apólice cadastrada");
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar apólice");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(policy) {
    if (!window.confirm(`Remover apólice ${policy.policyNumber || policy.id} de ${policy.plate}?`)) return;
    try {
      await deletePolicy(policy.id);
      toast.success("Apólice removida");
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover apólice");
    }
  }

  async function handleBuscarNoPortal(vehicle) {
    setFetchingPlate(vehicle.plate);
    try {
      const result = await fetchPolicyFromPortal(vehicle.plate);
      if (!result.found) {
        toast.error(`Nenhuma apólice vigente encontrada no portal para ${vehicle.plate}`);
        return;
      }
      setConfirmModal({ vehicle, result });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao buscar apólice no portal");
    } finally {
      setFetchingPlate(null);
    }
  }

  async function handleConfirmSave() {
    if (!confirmModal) return;
    const { vehicle, result } = confirmModal;
    setConfirmSaving(true);
    try {
      await createPolicy({
        plate:           vehicle.plate,
        policyNumber:    result.data.policyNumber,
        startDate:       result.data.startDate,
        endDate:         result.data.endDate,
        insuredName:     result.data.insuredName,
        cpfCnpj:         result.data.cpfCnpj,
        vehicleModel:    result.data.vehicleModel,
        vehicleBrand:    result.data.vehicleBrand,
        bonus:           result.data.bonus,
        statusDescricao: result.data.statusDescricao,
        source:          "ETL",
      });
      toast.success("Apólice importada e cadastrada");
      setConfirmModal(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar apólice");
    } finally {
      setConfirmSaving(false);
    }
  }

  async function handleLoadReport() {
    setReportLoading(true);
    try {
      const data = await getPolicyReport(reportType);
      setReportData(data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar relatório");
    } finally {
      setReportLoading(false);
    }
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function handleVerifyAll() {
    setVerifying(true);
    setVerifyProgress(null);
    try {
      const { jobId } = await startVerification();

      pollingRef.current = setInterval(async () => {
        try {
          const status = await getVerificationStatus(jobId);
          setVerifyProgress({ processed: status.processed, total: status.total });

          if (status.status === "DONE") {
            stopPolling();
            setVerifying(false);
            setVerifyProgress(null);
            setVerifyModal(status.result);
          } else if (status.status === "ERROR" || status.status === "NOT_FOUND") {
            stopPolling();
            setVerifying(false);
            toast.error("Erro durante a verificação. Tente novamente.");
          }
        } catch (e) {
          stopPolling();
          setVerifying(false);
          toast.error("Erro ao verificar status da conferência");
        }
      }, 3000);

    } catch (error) {
      console.error(error);
      setVerifying(false);
      toast.error("Erro ao iniciar conferência com o portal");
    }
  }

  async function handleUpdateFromPortal(entry) {
    setUpdatingId(entry.id);
    try {
      await updatePolicy(entry.id, {
        plate:           entry.plate,
        policyNumber:    entry.portalPolicyNumber,
        endDate:         entry.portalEndDate,
        statusDescricao: entry.portalStatusDescricao,
      });
      toast.success(`Apólice de ${entry.plate} atualizada`);
      // reflect update in modal
      setVerifyModal((prev) => ({
        ...prev,
        divergent: prev.divergent.filter((e) => e.id !== entry.id),
        correct:   [...prev.correct, { ...entry,
          policyNumber:    entry.portalPolicyNumber,
          endDate:         entry.portalEndDate,
          statusDescricao: entry.portalStatusDescricao,
          portalPolicyNumber:   entry.portalPolicyNumber,
          portalEndDate:        entry.portalEndDate,
          portalStatusDescricao: entry.portalStatusDescricao,
        }],
      }));
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar apólice");
    } finally {
      setUpdatingId(null);
    }
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const currentReportLabel = REPORT_TYPES.find((r) => r.key === reportType)?.label || "";

  const tabs = [
    { key: "pending",  label: "Sem Apólice", count: pendingVehicles.length },
    { key: "active",   label: "Vigentes",    count: activePolicies.length },
    { key: "history",  label: "Histórico",   count: historyPolicies.length },
    { key: "reports",  label: "Relatórios",  count: null },
  ];

  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`
              flex flex-1 items-center justify-center gap-2
              rounded-xl px-4 py-2.5 text-sm font-semibold
              transition
              ${tab === t.key ? "bg-white text-black shadow" : "text-zinc-400 hover:text-white"}
            `}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  tab === t.key ? "bg-black/10 text-black" : "bg-zinc-700 text-zinc-300"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-500">Carregando...</div>
      ) : (
        <>
          {/* ── Sem Apólice ── */}
          {tab === "pending" && (
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              {pendingVehicles.length === 0 ? (
                <p className="py-12 text-center text-zinc-500">
                  Todos os veículos possuem apólice vigente
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-zinc-950 text-left text-xs text-zinc-400">
                      <tr>
                        <th className="px-4 py-3">Placa</th>
                        <th className="px-4 py-3">Segurado</th>
                        <th className="px-4 py-3">Plataforma</th>
                        <th className="px-4 py-3">Dispositivo</th>
                        <th className="px-4 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingVehicles.map((vehicle) => (
                        <tr key={vehicle.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                          <td className="px-4 py-3 font-mono font-semibold">{vehicle.plate}</td>
                          <td className="px-4 py-3 text-sm">{vehicle.insuredName || "--"}</td>
                          <td className="px-4 py-3 text-sm text-zinc-400">{vehicle.platform || "--"}</td>
                          <td className="px-4 py-3 text-sm text-zinc-400">
                            {vehicle.activeDevice
                              ? vehicle.lineNumber
                                ? `${vehicle.activeDevice} · ${vehicle.lineNumber}`
                                : vehicle.activeDevice
                              : "--"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openCreateModal(vehicle)}
                                className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90"
                              >
                                <Plus size={12} /> Cadastrar
                              </button>
                              <button
                                onClick={() => handleBuscarNoPortal(vehicle)}
                                disabled={fetchingPlate === vehicle.plate}
                                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {fetchingPlate === vehicle.plate ? (
                                  <><Loader2 size={12} className="animate-spin" /> Buscando...</>
                                ) : (
                                  "Buscar no Portal"
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Vigentes ── */}
          {tab === "active" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={handleVerifyAll}
                  disabled={verifying || activePolicies.length === 0}
                  className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {verifyProgress
                        ? `Verificando ${verifyProgress.processed}/${verifyProgress.total}...`
                        : "Iniciando..."}
                    </>
                  ) : (
                    "Conferir com Portal"
                  )}
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                {activePolicies.length === 0 ? (
                  <p className="py-12 text-center text-zinc-500">Nenhuma apólice vigente cadastrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-zinc-950 text-left text-xs text-zinc-400">
                        <tr>
                          <th className="px-4 py-3">Placa</th>
                          <th className="px-4 py-3">Segurado</th>
                          <th className="px-4 py-3">Apólice</th>
                          <th className="px-4 py-3">Início</th>
                          <th className="px-4 py-3">Fim</th>
                          <th className="px-4 py-3">Dias Restantes</th>
                          <th className="px-4 py-3">Status Portal</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePolicies.map((policy) => {
                          const days = daysRemaining(policy.endDate);
                          return (
                            <tr key={policy.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                              <td className="px-4 py-3 font-mono font-semibold">{policy.plate || "--"}</td>
                              <td className="px-4 py-3 text-sm">{policy.insuredName || "--"}</td>
                              <td className="px-4 py-3 text-sm font-mono text-zinc-300">{policy.policyNumber || "--"}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">{formatLocalDate(policy.startDate)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">{formatLocalDate(policy.endDate)}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${daysBadgeClass(days)}`}>
                                  {daysLabel(days)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <PortalStatusBadge status={policy.statusDescricao} />
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={policy.status} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(policy)}
                                    title="Editar"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 transition hover:bg-zinc-800"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(policy)}
                                    title="Remover"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Histórico ── */}
          {tab === "history" && (
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              {historyPolicies.length === 0 ? (
                <p className="py-12 text-center text-zinc-500">Nenhum registro histórico</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-zinc-950 text-left text-xs text-zinc-400">
                      <tr>
                        <th className="px-4 py-3">Placa</th>
                        <th className="px-4 py-3">Segurado</th>
                        <th className="px-4 py-3">Apólice</th>
                        <th className="px-4 py-3">Início</th>
                        <th className="px-4 py-3">Fim</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyPolicies.map((policy) => (
                        <tr key={policy.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                          <td className="px-4 py-3 font-mono font-semibold">{policy.plate || "--"}</td>
                          <td className="px-4 py-3 text-sm">{policy.insuredName || "--"}</td>
                          <td className="px-4 py-3 text-sm font-mono text-zinc-300">{policy.policyNumber || "--"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">{formatLocalDate(policy.startDate)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">{formatLocalDate(policy.endDate)}</td>
                          <td className="px-4 py-3"><StatusBadge status={policy.status} /></td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDelete(policy)}
                              title="Remover"
                              className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Relatórios ── */}
          {tab === "reports" && (
            <div className="space-y-4">

              {/* Type selector */}
              <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                {REPORT_TYPES.map((rt) => (
                  <button
                    key={rt.key}
                    onClick={() => { setReportType(rt.key); setReportData(null); }}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      reportType === rt.key
                        ? "bg-white text-black"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {rt.label}
                  </button>
                ))}
                <button
                  onClick={handleLoadReport}
                  disabled={reportLoading}
                  className="ml-auto flex items-center gap-2 rounded-xl bg-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-600 disabled:opacity-50"
                >
                  {reportLoading ? <><Loader2 size={14} className="animate-spin" /> Buscando...</> : "Buscar"}
                </button>
              </div>

              {/* Results */}
              {reportData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-400">
                      {reportData.length} registro{reportData.length !== 1 ? "s" : ""} — {currentReportLabel}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => exportExcel(reportData, currentReportLabel)}
                        className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                      >
                        Exportar Excel
                      </button>
                      <button
                        onClick={() => exportPDF(reportData, currentReportLabel)}
                        className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                      >
                        Exportar PDF
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                    {reportData.length === 0 ? (
                      <p className="py-12 text-center text-zinc-500">Nenhum registro para este relatório</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-zinc-950 text-left text-xs text-zinc-400">
                            <tr>
                              <th className="px-4 py-3">Placa</th>
                              <th className="px-4 py-3">Segurado</th>
                              <th className="px-4 py-3">Apólice</th>
                              <th className="px-4 py-3">Fim Vigência</th>
                              <th className="px-4 py-3">Dias Restantes</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.map((r, i) => {
                              const days = r.daysRemaining;
                              return (
                                <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                                  <td className="px-4 py-3 font-mono font-semibold">{r.plate || "--"}</td>
                                  <td className="px-4 py-3 text-sm">{r.insuredName || "--"}</td>
                                  <td className="px-4 py-3 text-sm font-mono text-zinc-300">{r.policyNumber || "--"}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                                    {r.endDate ? formatLocalDate(r.endDate) : "--"}
                                  </td>
                                  <td className="px-4 py-3">
                                    {days != null ? (
                                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${daysBadgeClass(days)}`}>
                                        {daysLabel(days)}
                                      </span>
                                    ) : (
                                      <span className="text-zinc-500 text-sm">--</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        REPORT_STATUS_CLASS[r.statusLabel] || "bg-zinc-700/40 text-zinc-400"
                                      }`}
                                    >
                                      {REPORT_STATUS_LABEL[r.statusLabel] || r.statusLabel}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal — criar / editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">

            <h3 className="mb-5 text-lg font-semibold">
              {editPolicy ? "Editar Apólice" : `Cadastrar Apólice — ${modalPlate}`}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">Número da Apólice *</label>
                  <input
                    required type="text"
                    value={form.policyNumber}
                    onChange={(e) => setField("policyNumber", e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                    placeholder="Ex: 123456789"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">CPF / CNPJ</label>
                  <input
                    type="text"
                    value={form.cpfCnpj}
                    onChange={(e) => setField("cpfCnpj", e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                    placeholder="Ex: 000.000.000-00"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">Início de Vigência</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setField("startDate", e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">Fim de Vigência</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setField("endDate", e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">Marca do Veículo</label>
                  <input
                    type="text"
                    value={form.vehicleBrand}
                    onChange={(e) => setField("vehicleBrand", e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                    placeholder="Ex: Honda"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">Bônus</label>
                  <input
                    type="number" min="0"
                    value={form.bonus}
                    onChange={(e) => setField("bonus", e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                    placeholder="Ex: 3"
                  />
                </div>

              </div>

              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">Nome do Segurado</label>
                <input
                  type="text"
                  value={form.insuredName}
                  onChange={(e) => setField("insuredName", e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">Modelo do Veículo</label>
                <input
                  type="text"
                  value={form.vehicleModel}
                  onChange={(e) => setField("vehicleModel", e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  placeholder="Ex: Civic 2022"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button" onClick={closeModal}
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-2.5 text-sm font-semibold transition hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving}
                  className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : editPolicy ? "Salvar" : "Cadastrar"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal — confirmar apólice buscada no portal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">

            <h3 className="mb-1 text-lg font-semibold">Apólice encontrada</h3>
            <p className="mb-5 text-sm text-zinc-400">
              Placa {confirmModal.vehicle.plate} — confirme os dados antes de salvar.
            </p>

            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
              <Row label="Apólice"      value={confirmModal.result.data.policyNumber} />
              <Row label="Vigência"     value={`${formatLocalDate(confirmModal.result.data.startDate)} → ${formatLocalDate(confirmModal.result.data.endDate)}`} />
              <Row label="Segurado"     value={confirmModal.result.data.insuredName} />
              <Row label="CPF/CNPJ"     value={confirmModal.result.data.cpfCnpj} />
              <Row label="Modelo"       value={[confirmModal.result.data.vehicleBrand, confirmModal.result.data.vehicleModel].filter(Boolean).join(" ") || null} />
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Status Portal</span>
                <PortalStatusBadge status={confirmModal.result.data.statusDescricao} />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)} disabled={confirmSaving}
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-2.5 text-sm font-semibold transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSave} disabled={confirmSaving}
                className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                {confirmSaving ? "Salvando..." : "Confirmar e Salvar"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal — Conferência com Portal */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">

            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Resultado da Conferência com Portal</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {verifyModal.correct.length} corretas · {verifyModal.divergent.length} divergentes · {verifyModal.notFound.length} não encontradas
                </p>
              </div>
              <button
                onClick={() => setVerifyModal(null)}
                className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800"
              >
                Fechar
              </button>
            </div>

            {/* Divergentes */}
            {verifyModal.divergent.length > 0 && (
              <div className="mb-5">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-yellow-400">
                  <AlertTriangle size={16} /> Divergentes ({verifyModal.divergent.length})
                </h4>
                <div className="space-y-3">
                  {verifyModal.divergent.map((e) => (
                    <div key={e.id} className="rounded-xl border border-yellow-500/20 bg-zinc-950 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-mono font-semibold">{e.plate}</span>
                        <button
                          onClick={() => handleUpdateFromPortal(e)}
                          disabled={updatingId === e.id}
                          className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                        >
                          {updatingId === e.id ? <><Loader2 size={12} className="animate-spin" /> Atualizando...</> : "Atualizar"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="mb-1 font-semibold text-zinc-400">Banco</p>
                          <DiffRow label="Apólice"  val={e.policyNumber}    changed={e.policyNumber !== e.portalPolicyNumber} />
                          <DiffRow label="Fim"      val={formatLocalDate(e.endDate)}  changed={String(e.endDate) !== String(e.portalEndDate)} />
                          <DiffRow label="Status"   val={e.statusDescricao}  changed={e.statusDescricao !== e.portalStatusDescricao} />
                        </div>
                        <div>
                          <p className="mb-1 font-semibold text-zinc-400">Portal</p>
                          <DiffRow label="Apólice"  val={e.portalPolicyNumber}    changed={e.policyNumber !== e.portalPolicyNumber} highlight />
                          <DiffRow label="Fim"      val={formatLocalDate(e.portalEndDate)}  changed={String(e.endDate) !== String(e.portalEndDate)} highlight />
                          <DiffRow label="Status"   val={e.portalStatusDescricao}  changed={e.statusDescricao !== e.portalStatusDescricao} highlight />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Não encontradas */}
            {verifyModal.notFound.length > 0 && (
              <div className="mb-5">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-400">
                  <XCircle size={16} /> Não encontradas no portal ({verifyModal.notFound.length})
                </h4>
                <div className="space-y-1">
                  {verifyModal.notFound.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-xl border border-red-500/20 bg-zinc-950 px-4 py-2.5">
                      <span className="font-mono text-sm font-semibold">{e.plate}</span>
                      <span className="text-xs text-zinc-500">{e.policyNumber || "--"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Corretas */}
            {verifyModal.correct.length > 0 && (
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-400">
                  <CheckCircle2 size={16} /> Corretas ({verifyModal.correct.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {verifyModal.correct.map((e) => (
                    <span key={e.id} className="rounded-full bg-green-500/10 px-3 py-1 font-mono text-xs text-green-400">
                      {e.plate}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );

}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium">{value || "--"}</span>
    </div>
  );
}

function DiffRow({ label, val, changed, highlight }) {
  return (
    <div className={`flex gap-2 py-0.5 ${changed ? (highlight ? "text-yellow-300 font-semibold" : "text-zinc-500 line-through") : "text-zinc-300"}`}>
      <span className="w-12 shrink-0 text-zinc-500">{label}</span>
      <span>{val || "--"}</span>
    </div>
  );
}
