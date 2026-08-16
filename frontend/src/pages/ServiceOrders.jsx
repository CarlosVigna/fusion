import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  getServiceOrders,
  createServiceOrder,
  updateServiceOrder,
  updateScheduling,
  updateFinancialApproval,
  confirmCompletion,
  getVehicleSignal,
  deleteServiceOrder,
  getServiceOrderAuditLog,
  getFullAuditLog,
} from "../services/serviceOrderService";
import { getTechnicians } from "../services/technicianService";
import { useAuthStore } from "../store/authStore";

const STATUS_LABEL    = { ABERTO: "Aberto", AGENDADO: "Agendado", CONCLUIDO: "Concluído" };
const FINANCIAL_LABEL = { PENDENTE: "Pendente", APROVADO: "Aprovado", REPROVADO: "Reprovado" };
const STATUS_COLOR = {
  ABERTO:    "bg-blue-200 text-blue-900 border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
  AGENDADO:  "bg-yellow-200 text-yellow-900 border-yellow-300 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/30",
  CONCLUIDO: "bg-green-200 text-green-900 border-green-300 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30",
};
const FIN_COLOR = {
  PENDENTE:  "bg-yellow-200 text-yellow-800 dark:bg-zinc-800 dark:text-zinc-400",
  APROVADO:  "bg-green-200 text-green-800 dark:bg-green-500/10 dark:text-green-400",
  REPROVADO: "bg-red-200 text-red-800 dark:bg-red-500/10 dark:text-red-400",
};
const ACTION_LABEL = {
  CRIADA: "Criada", EDITADA: "Editada", AGENDADA: "Agendada",
  APROVADA: "Aprovada", REPROVADA: "Reprovada", CONCLUIDA: "Concluída", EXCLUIDA: "Excluída",
};
const ACTION_COLOR = {
  CRIADA:   "bg-blue-500/10 text-blue-400",
  EDITADA:  "bg-zinc-700 text-zinc-300",
  AGENDADA: "bg-yellow-500/10 text-yellow-400",
  APROVADA: "bg-green-500/10 text-green-400",
  REPROVADA:"bg-red-500/10 text-red-400",
  CONCLUIDA:"bg-teal-500/10 text-teal-400",
  EXCLUIDA: "bg-red-500/10 text-red-400",
};
const AUDIT_ACTIONS = ["CRIADA", "EDITADA", "AGENDADA", "APROVADA", "REPROVADA", "CONCLUIDA", "EXCLUIDA"];
const SERVICE_TYPES       = ["INSTALACAO", "TROCA", "MANUTENCAO"];
const SCHEDULING_STATUSES = ["ABERTO", "AGENDADO", "CONCLUIDO"];

const ITEMS_PER_PAGE = 20;

const EMPTY_ORDER = {
  requestedBy: "", plate: "", chassis: "", equipment: "LUMINI",
  serviceType: "INSTALACAO", zipCode: "", address: "", neighborhood: "",
  city: "", state: "", customerName: "", customerPhone: "", observations: "",
};

function fmt(v) { return v != null ? `R$ ${Number(v).toFixed(2)}` : null; }

function Badge({ label, colorClass }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${colorClass}`}>{label}</span>;
}

function SlaChip({ days, isLate }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isLate ? "bg-red-200 text-red-900 dark:bg-red-500/10 dark:text-red-400" : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
      {days}d{isLate ? " ⚠" : ""}
    </span>
  );
}

function Field({ label, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReadField({ label, value }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <div className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400 min-h-[2.25rem]">
        {value || <span className="text-zinc-600">—</span>}
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none";

function DrawerSection({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DrawerRow({ label, value, children }) {
  if (!value && value !== 0 && !children) return null;
  return (
    <div>
      <span className="text-[11px] text-zinc-600">{label}: </span>
      {children || <span className="text-[11px] text-zinc-300 font-medium">{value}</span>}
    </div>
  );
}

async function fetchCep(cep) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res  = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch { return null; }
}

const GEOCODE_KEY = import.meta.env.VITE_GEOCODE_KEY || '6a767720c9a23759209230ybg19c2d3';

async function geocodeAddress(query) {
  const url = `https://geocode.maps.co/search?q=${encodeURIComponent(query)}&api_key=${GEOCODE_KEY}&countrycodes=br&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  return null;
}

function isScheduledPassed(o) {
  if (!o?.scheduledDate) return false;
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (!o.scheduledTime) return o.scheduledDate <= todayUtc;
  const scheduledUtc = new Date(`${o.scheduledDate}T${o.scheduledTime}:00-03:00`);
  return scheduledUtc < new Date();
}

export default function ServiceOrders() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const role    = user?.role;
  const isAdmin = role === "ADMIN";
  const isOp    = role === "OPERATOR" || isAdmin;
  const isField = role === "FIELD" || isOp;
  const isTech  = role === "TECHNICIAN";

  const [orders, setOrders]           = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter]           = useState(searchParams.get("filter") || "");
  const [modal, setModal]             = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [displacementModal, setDisplacementModal] = useState(null);
  const [displacementDetailModal, setDisplacementDetailModal] = useState(false);
  const [cepLoading, setCepLoading]         = useState(false);
  const [searchText, setSearchText]         = useState("");
  const [filterServiceType, setFilterServiceType] = useState("");
  const [filterTechnicianId, setFilterTechnicianId] = useState("");
  const [selectedIds, setSelectedIds]       = useState(new Set());
  const [displayPage, setDisplayPage]       = useState(0);
  const [activeTab, setActiveTab]           = useState(searchParams.get("tab") === "auditoria" ? "auditoria" : "ordens");

  // Drawer: histórico de auditoria por OS
  const [orderAuditLog, setOrderAuditLog]   = useState([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);

  // Tab Auditoria
  const [auditLogs, setAuditLogs]           = useState([]);
  const [auditLoading, setAuditLoading]     = useState(false);
  const [auditPlate, setAuditPlate]         = useState("");
  const [auditAction, setAuditAction]       = useState("");
  const [auditUser, setAuditUser]           = useState("");
  const [auditDateFrom, setAuditDateFrom]   = useState("");
  const [auditDateTo, setAuditDateTo]       = useState("");

  // NOTIFICAÇÃO: rastrear OS em pend. aprovação já vistas (TECH)
  const seenPendingIds = useRef(null);

  // Histórico colapsável no drawer
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => { setDisplayPage(0); }, [filter, searchText, filterServiceType, filterTechnicianId]);

  useEffect(() => {
    if (activeTab === "auditoria" && isAdmin) loadAuditLog();
  }, [activeTab]);

  useEffect(() => {
    if (!selectedOrder) { setOrderAuditLog([]); setShowHistory(false); return; }
    setShowHistory(false);
    setAuditLogLoading(true);
    getServiceOrderAuditLog(selectedOrder.id)
      .then(data => setOrderAuditLog(data))
      .catch(() => {})
      .finally(() => setAuditLogLoading(false));
  }, [selectedOrder?.id]);

  async function load() {
    setLoading(true);
    try {
      const [osResult, techsResult] = await Promise.allSettled([getServiceOrders(), getTechnicians()]);
      if (osResult.status === "fulfilled") {
        const newOrders = osResult.value;
        setOrders(newOrders);
        if (isTech) {
          const pending = newOrders.filter(o => (o.displacementValue ?? 0) > 0 && o.financialApprovalStatus === "PENDENTE");
          if (seenPendingIds.current === null) {
            seenPendingIds.current = new Set(pending.map(o => o.id));
          } else {
            const newOnes = pending.filter(o => !seenPendingIds.current.has(o.id));
            newOnes.forEach(o => {
              toast(`OS ${o.plate || "?"} aguarda aprovação de deslocamento`, { icon: "💰" });
              seenPendingIds.current.add(o.id);
            });
          }
        }
      } else {
        console.error("[ServiceOrders] falha ao carregar ordens:", osResult.reason);
      }
      if (techsResult.status === "fulfilled") setTechnicians(techsResult.value);
      else console.error("[ServiceOrders] falha ao carregar tecnicos:", techsResult.reason);
    } finally { setLoading(false); }
  }

  async function loadAuditLog() {
    setAuditLoading(true);
    try {
      const data = await getFullAuditLog({
        plate: auditPlate || undefined,
        action: auditAction || undefined,
        performedBy: auditUser || undefined,
        dateFrom: auditDateFrom || undefined,
        dateTo: auditDateTo || undefined,
      });
      setAuditLogs(data);
    } catch { toast.error("Erro ao carregar auditoria"); }
    finally { setAuditLoading(false); }
  }

  function applyFilter(list) {
    let result = list;
    switch (filter) {
      case "ABERTO":    result = result.filter(o => o.schedulingStatus === "ABERTO" && !o.technician); break;
      case "AGENDADO":  result = result.filter(o => o.schedulingStatus === "AGENDADO"); break;
      case "CONCLUIDO": result = result.filter(o => o.schedulingStatus === "CONCLUIDO"); break;
      case "LATE":      result = result.filter(o => o.late); break;
      // BUG 1: apenas OS com deslocamento > 0 e aprovação pendente
      case "PEND_FIN":  result = result.filter(o => (o.displacementValue ?? 0) > 0 && o.financialApprovalStatus === "PENDENTE"); break;
      case "PEND_CONCLUSAO": {
        const today = new Date().toISOString().slice(0, 10);
        result = result.filter(o => o.technician && o.scheduledDate && o.scheduledDate <= today && o.serviceValue && o.schedulingStatus === "AGENDADO");
        break;
      }
      case "PRAZO_CUMPRIDO":
        result = result.filter(o => o.schedulingStatus === "AGENDADO" && o.technician && o.serviceValue && isScheduledPassed(o));
        break;
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(o =>
        (o.plate || "").toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.city || "").toLowerCase().includes(q)
      );
    }
    if (filterServiceType) result = result.filter(o => o.serviceType === filterServiceType);
    if (filterTechnicianId) result = result.filter(o => String(o.technician?.id) === filterTechnicianId);
    return result;
  }

  function setForm(updater) {
    setModal(p => ({ ...p, form: typeof updater === "function" ? updater(p.form) : updater }));
  }

  async function handleCepLookup(cep) {
    setCepLoading(true);
    const data = await fetchCep(cep);
    setCepLoading(false);
    if (data) {
      setForm(f => ({
        ...f,
        address:      data.logradouro || f.address,
        neighborhood: data.bairro     || f.neighborhood,
        city:         data.localidade || f.city,
        state:        data.uf         || f.state,
      }));
    }
  }

  const visible = applyFilter(orders);
  const totalPages = Math.ceil(visible.length / ITEMS_PER_PAGE);
  const pagedVisible = visible.slice(displayPage * ITEMS_PER_PAGE, (displayPage + 1) * ITEMS_PER_PAGE);
  const allSelected = visible.length > 0 && visible.every(o => selectedIds.has(o.id));

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(visible.map(o => o.id)));
  }

  function canConcluir(o) {
    if (isTech || !isField) return false;
    if (!o || o.schedulingStatus !== "AGENDADO") return false;
    if (!o.technician || !o.scheduledDate || !o.serviceValue) return false;
    return isScheduledPassed(o);
  }

  // BUG 4: Regra de edição por role e schedulingStatus
  function canEdit(o) {
    if (isTech || !isField) return false;
    if (o.schedulingStatus === "CONCLUIDO") return false;
    if (isAdmin) return true;
    return o.schedulingStatus === "ABERTO";
  }

  async function handleConcluir(orderId) {
    try {
      const { hasSignal } = await getVehicleSignal(orderId);
      setConfirmModal({ type: hasSignal ? "completion" : "no-signal", orderId });
    } catch {
      setConfirmModal({ type: "no-signal", orderId });
    }
  }

  function copySelected() {
    const rows = visible.filter(o => selectedIds.has(o.id));
    const SEP = "════════════════════════════════";
    const text = rows.map(o => {
      const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
      const fmtVal  = (v) => v != null ? `R$ ${Number(v).toFixed(2).replace(".", ",")}` : "—";
      return [
        SEP,
        `ORDEM DE SERVIÇO — ${o.plate || "SEM PLACA"}`,
        SEP,
        "",
        "📋 DADOS DA SOLICITAÇÃO",
        `Solicitante: ${o.requestedBy || "—"}`,
        `Data: ${fmtDate(o.requestedAt)} | SLA: ${o.slaDays} dias`,
        `Criado por: ${o.createdBy || "—"}`,
        "",
        "🚗 DADOS DO VEÍCULO",
        `Placa: ${o.plate || "—"}`,
        `Chassi: ${o.chassis || "—"}`,
        `Equipamento: ${o.equipment || "—"}`,
        `Serviço: ${o.serviceType || "—"}`,
        "",
        "📍 DADOS DO CLIENTE",
        `Nome: ${o.customerName || "—"}`,
        `Telefone: ${o.customerPhone || "—"}`,
        `Endereço: ${o.address || "—"}`,
        `Bairro: ${o.neighborhood || "—"} | Cidade: ${[o.city, o.state].filter(Boolean).join("/") || "—"}`,
        `CEP: ${o.zipCode || "—"}`,
        "",
        "🔧 AGENDAMENTO",
        `Técnico: ${o.technician?.name || "—"}`,
        `Data: ${o.scheduledDate || "—"} às ${o.scheduledTime || "—"}`,
        `Status: ${STATUS_LABEL[o.schedulingStatus] || o.schedulingStatus}`,
        "",
        "💰 VALORES",
        `Serviço: ${fmtVal(o.serviceValue)}`,
        `Deslocamento: ${fmtVal(o.displacementValue)}`,
        `Total: ${fmtVal(o.totalValue)}`,
        `Aprovação: ${FINANCIAL_LABEL[o.financialApprovalStatus] || o.financialApprovalStatus || "—"}`,
        "",
        "📝 OBSERVAÇÕES",
        `${o.observations || "—"}`,
        SEP,
      ].join("\n");
    }).join("\n\n");
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`${rows.length} OS copiada(s)`))
      .catch(() => toast.error("Erro ao copiar"));
  }

  function openCreate() {
    setModal({ type: "create", form: { ...EMPTY_ORDER, requestedBy: user?.name || "" } });
  }

  function openEdit(o) {
    setModal({
      type: "edit",
      id: o.id,
      form: {
        requestedBy:       o.requestedBy       || "",
        plate:             o.plate             || "",
        chassis:           o.chassis           || "",
        equipment:         o.equipment         || "LUMINI",
        serviceType:       o.serviceType       || "INSTALACAO",
        zipCode:           o.zipCode           || "",
        address:           o.address           || "",
        neighborhood:      o.neighborhood      || "",
        city:              o.city              || "",
        state:             o.state             || "",
        customerName:      o.customerName      || "",
        customerPhone:     o.customerPhone     || "",
        observations:      o.observations      || "",
        technicianId:      o.technician?.id    || "",
        schedulingStatus:  o.schedulingStatus  || "ABERTO",
        scheduledDate:     o.scheduledDate     || "",
        scheduledTime:     o.scheduledTime     || "",
        serviceValue:      o.serviceValue      != null ? String(o.serviceValue)      : "",
        displacementValue: o.displacementValue != null ? String(o.displacementValue) : "",
        _plate:         o.plate,
        _chassis:       o.chassis,
        _equipment:     o.equipment,
        _serviceType:   o.serviceType,
        _customerName:  o.customerName,
        _customerPhone: o.customerPhone,
        _city:          o.city,
        _address:       o.address,
      },
    });
  }

  async function handleSaveCreate() {
    if (!modal.form.serviceType) {
      toast.error("Tipo de serviço é obrigatório");
      return;
    }
    if (!modal.form.customerName?.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }
    try {
      await createServiceOrder(modal.form);
      toast.success("OS criada");
      setModal(null);
      load();
    } catch (e) { toast.error("Erro ao criar OS: " + (e?.message || "")); }
  }

  async function doSave(id, schedPayload, basePayload) {
    try {
      if (isTech) {
        await updateScheduling(id, schedPayload);
      } else if (!isOp) {
        await updateServiceOrder(id, basePayload);
      } else {
        await updateServiceOrder(id, basePayload);
        await updateScheduling(id, schedPayload);
      }
      toast.success("OS atualizada");
      setModal(null);
      setSelectedOrder(null);
      setDisplacementModal(null);
      load();
    } catch { toast.error("Erro ao salvar"); }
  }

  async function handleSaveEdit() {
    try {
      const f = modal.form;
      const basePayload = {
        requestedBy: f.requestedBy, plate: f.plate, chassis: f.chassis,
        equipment: f.equipment, serviceType: f.serviceType,
        city: f.city, address: f.address, neighborhood: f.neighborhood,
        state: f.state, zipCode: f.zipCode,
        customerName: f.customerName, customerPhone: f.customerPhone,
        observations: f.observations,
      };

      let techLat = null, techLon = null, clientLat = null, clientLon = null;
      let technicianAddress = null, clientAddress = null;
      if (f.technicianId && (isTech || isOp)) {
        try {
          const selectedTech = technicians.find(t => String(t.id) === String(f.technicianId));
          if (selectedTech) {
            technicianAddress = [selectedTech.address, selectedTech.city, selectedTech.state].filter(Boolean).join(", ");
            if (!selectedTech.latitude) {
              if (technicianAddress) {
                const c = await geocodeAddress(technicianAddress + ", Brasil");
                if (c) { techLat = c.lat; techLon = c.lon; }
              }
            }
          }
          const clientQuery = [f.city || f._city, f.state || f._state].filter(Boolean).join(", ");
          if (clientQuery.trim()) {
            clientAddress = clientQuery;
            const c = await geocodeAddress(clientQuery + ", Brasil");
            if (c) { clientLat = c.lat; clientLon = c.lon; }
          }
        } catch { /* geocoding falhou */ }
      }

      const selectedTech = technicians.find(t => String(t.id) === String(f.technicianId));
      const effTechLat = techLat ?? selectedTech?.latitude;
      const effTechLon = techLon ?? selectedTech?.longitude;

      let calculatedKm = null;
      let calculatedDisplacement = 0;
      if (effTechLat && effTechLon && clientLat && clientLon) {
        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${effTechLon},${effTechLat};${clientLon},${clientLat}?overview=false`;
          const res = await fetch(osrmUrl);
          const data = await res.json();
          if (data.routes?.length > 0) {
            const oneWayKm = data.routes[0].distance / 1000;
            calculatedKm = Math.round(oneWayKm * 2 * 10) / 10;
            if (calculatedKm > 40) {
              calculatedDisplacement = Math.round((calculatedKm - 40) * 1.20 * 100) / 100;
            }
          }
        } catch { /* OSRM falhou */ }
      }

      const schedPayload = {
        scheduledDate:     f.scheduledDate    || null,
        scheduledTime:     f.scheduledTime    || null,
        serviceValue:      f.serviceValue     ? Number(f.serviceValue)     : null,
        displacementValue: f.displacementValue? Number(f.displacementValue): null,
        observations:      f.observations     || null,
      };
      if (f.technicianId) schedPayload.technicianId = f.technicianId;
      if (!isTech) schedPayload.schedulingStatus = f.schedulingStatus;
      if (techLat != null) { schedPayload.techLat = techLat; schedPayload.techLon = techLon; }
      if (clientLat != null) { schedPayload.clientLat = clientLat; schedPayload.clientLon = clientLon; }
      if (technicianAddress) schedPayload.technicianAddress = technicianAddress;
      if (clientAddress) schedPayload.clientAddress = clientAddress;

      if (calculatedDisplacement > 0) {
        setDisplacementModal({
          km: calculatedKm,
          displacement: calculatedDisplacement,
          onConfirm: () => doSave(modal.id, schedPayload, basePayload),
        });
        return;
      }

      await doSave(modal.id, schedPayload, basePayload);
    } catch { toast.error("Erro ao salvar"); }
  }

  async function handleFinancial(id, status) {
    try {
      await updateFinancialApproval(id, status);
      toast.success("Aprovação atualizada");
      setSelectedOrder(null);
      load();
    } catch { toast.error("Erro"); }
  }

  async function handleConfirmCompletion() {
    const { orderId } = confirmModal;
    try {
      const result = await confirmCompletion(orderId);
      if (result.completedWithoutSignal) {
        toast("OS concluída — veículo sem sinal registrado", { icon: "⚠️" });
      } else {
        toast.success("Conclusão confirmada");
      }
      setConfirmModal(null);
      setSelectedOrder(null);
      load();
    } catch (e) {
      const msg = e?.response?.data?.message || "Verifique se técnico e valor do serviço estão preenchidos";
      toast.error(msg);
    }
  }

  async function handleDelete(o) {
    if (!confirm(`Excluir OS de ${o.customerName || o.plate || "?"}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteServiceOrder(o.id);
      toast.success("OS excluída");
      setSelectedOrder(null);
      load();
    } catch { toast.error("Erro ao excluir"); }
  }

  function canDelete(o) {
    return isField && !isTech &&
      o.requestedBy !== "PORTAL" &&
      !o.technician &&
      !o.scheduledDate &&
      !o.serviceValue;
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
            {activeTab === "ordens" && (
              <p className="text-zinc-400 mt-1">{visible.length} ordem(ns)</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "ordens" && selectedIds.size > 0 && (
              <button onClick={copySelected}
                className="flex items-center gap-2 rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800">
                Copiar Selecionadas ({selectedIds.size})
              </button>
            )}
            {isField && activeTab === "ordens" && (
              <button onClick={openCreate}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200">
                <Plus size={16} /> Nova Ordem
              </button>
            )}
          </div>
        </div>

        {/* Tabs — só ADMIN vê Auditoria */}
        {isAdmin && (
          <div className="flex gap-1">
            <button onClick={() => setActiveTab("ordens")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === "ordens" ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-900"}`}>
              Ordens
            </button>
            <button onClick={() => setActiveTab("auditoria")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === "auditoria" ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-900"}`}>
              Auditoria
            </button>
          </div>
        )}

        {/* Filtros da lista de ordens */}
        {activeTab === "ordens" && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Buscar placa, cliente, cidade…"
                className="rounded-xl border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none w-56"
              />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
              <option value="">Todos os status</option>
              <option value="ABERTO">Abertas</option>
              <option value="AGENDADO">Agendadas</option>
              <option value="CONCLUIDO">Concluídas</option>
              <option value="LATE">Atrasadas</option>
              <option value="PEND_FIN">Pend. Aprovação</option>
              <option value="PEND_CONCLUSAO">Pend. Conclusão</option>
              <option value="PRAZO_CUMPRIDO">Prazo Cumprido</option>
            </select>
            <select value={filterServiceType} onChange={e => setFilterServiceType(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
              <option value="">Todos os serviços</option>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterTechnicianId} onChange={e => setFilterTechnicianId(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
              <option value="">Todos os técnicos</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ===== TAB: AUDITORIA ===== */}
      {activeTab === "auditoria" && isAdmin && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Placa</label>
              <input value={auditPlate} onChange={e => setAuditPlate(e.target.value)}
                placeholder="ABC1234" className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none w-32" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Ação</label>
              <select value={auditAction} onChange={e => setAuditAction(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
                <option value="">Todas</option>
                {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Usuário</label>
              <input value={auditUser} onChange={e => setAuditUser(e.target.value)}
                placeholder="email@..." className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none w-44" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">De</label>
              <input type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Até</label>
              <input type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
            <button onClick={loadAuditLog}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200">
              Filtrar
            </button>
            {(auditPlate || auditAction || auditUser || auditDateFrom || auditDateTo) && (
              <button onClick={() => {
                setAuditPlate(""); setAuditAction(""); setAuditUser(""); setAuditDateFrom(""); setAuditDateTo("");
                setTimeout(loadAuditLog, 0);
              }}
                className="text-xs text-zinc-500 hover:text-white">
                Limpar
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Data/Hora</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Campo</th>
                  <th className="px-4 py-3">Valor Anterior</th>
                  <th className="px-4 py-3">Valor Novo</th>
                  <th className="px-4 py-3">Usuário</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Carregando...</td></tr>
                )}
                {!auditLoading && auditLogs.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhum registro encontrado</td></tr>
                )}
                {!auditLoading && auditLogs.map(l => (
                  <tr key={l.id} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400 whitespace-nowrap">
                      {l.performedAt ? new Date(l.performedAt).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{l.plate || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACTION_COLOR[l.action] || "bg-zinc-800 text-zinc-400"}`}>
                        {ACTION_LABEL[l.action] || l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{l.field || "—"}</td>
                    <td className="px-4 py-3 text-red-400 text-xs">{l.oldValue || "—"}</td>
                    <td className="px-4 py-3 text-green-400 text-xs">{l.newValue || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs truncate max-w-[180px]">{l.performedBy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB: ORDENS ===== */}
      {activeTab === "ordens" && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-white cursor-pointer" />
                </th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3">Cidade/Estado</th>
                <th className="px-4 py-3 hidden lg:table-cell">Endereço</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">Carregando...</td></tr>}
              {!loading && visible.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">Nenhuma OS encontrada</td></tr>}
              {pagedVisible.map((o) => (
                <tr key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className="border-b border-zinc-900 transition-colors hover:bg-zinc-900/40 cursor-pointer">
                  <td className="px-4 py-3 w-8" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} className="accent-white cursor-pointer" />
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">{o.plate || <span className="text-zinc-600">—</span>}</td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{o.requestedAt ? new Date(o.requestedAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3"><SlaChip days={o.slaDays} isLate={o.late} /></td>
                  <td className="px-4 py-3 text-zinc-400">{o.serviceType}</td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                    {[o.city, o.state].filter(Boolean).join(", ") || <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell max-w-[200px] truncate">{o.address || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge label={STATUS_LABEL[o.schedulingStatus]} colorClass={STATUS_COLOR[o.schedulingStatus]} />
                      {o.schedulingStatus === "ABERTO" && o.financialApprovalStatus === "REPROVADO" && (
                        <span className="rounded-full bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-400" title="Deslocamento reprovado — aguardando novo agendamento">⚠ Desl. reprovado</span>
                      )}
                      {o.serviceValueChangedAfterScheduling && (
                        <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400" title="Valor do serviço alterado após agendamento">⚠️ Valor</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => setSelectedOrder(o)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Ver detalhes">
                        <Eye size={14} />
                      </button>
                      {canDelete(o) && (
                        <button onClick={() => handleDelete(o)}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10" title="Excluir">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
              <span className="text-xs text-zinc-500">
                {visible.length} resultado(s) · página {displayPage + 1} de {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setDisplayPage(p => Math.max(0, p - 1))}
                  disabled={displayPage === 0}
                  className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ‹ Anterior
                </button>
                <button
                  onClick={() => setDisplayPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={displayPage >= totalPages - 1}
                  className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Próxima ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== DRAWER LATERAL ====== */}
      {selectedOrder && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl">

            <div className="flex items-start justify-between border-b border-zinc-800 p-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xl font-bold">{selectedOrder.plate || "Sem placa"}</span>
                  <Badge label={STATUS_LABEL[selectedOrder.schedulingStatus]} colorClass={STATUS_COLOR[selectedOrder.schedulingStatus]} />
                  {selectedOrder.late && <span className="text-xs text-red-400 font-semibold">⚠ Atrasada</span>}
                  {selectedOrder.completedWithoutSignal && (
                    <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">
                      Sem sinal
                    </span>
                  )}
                  {selectedOrder.schedulingStatus === "ABERTO" && selectedOrder.financialApprovalStatus === "REPROVADO" && (
                    <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">
                      ⚠ Deslocamento reprovado — aguardando novo agendamento
                    </span>
                  )}
                  {selectedOrder.serviceValueChangedAfterScheduling && (
                    <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">
                      ⚠️ Valor alterado após agendamento
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  {selectedOrder.serviceType} · {selectedOrder.requestedAt ? new Date(selectedOrder.requestedAt).toLocaleDateString("pt-BR") : "—"}
                  {selectedOrder.technician && ` · ${selectedOrder.technician.name}`}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">

                <DrawerSection title="Dados do Veículo">
                  <DrawerRow label="Placa"       value={selectedOrder.plate} />
                  <DrawerRow label="Chassi"      value={selectedOrder.chassis} />
                  <DrawerRow label="Equipamento" value={selectedOrder.equipment} />
                  <DrawerRow label="SLA"         value={`${selectedOrder.slaDays}d${selectedOrder.late ? " ⚠" : ""}`} />
                </DrawerSection>

                <DrawerSection title="Dados da Solicitação">
                  <DrawerRow label="Solicitante" value={selectedOrder.requestedBy} />
                  <DrawerRow label="Data"        value={selectedOrder.requestedAt ? new Date(selectedOrder.requestedAt).toLocaleDateString("pt-BR") : null} />
                  <DrawerRow label="Tipo"        value={selectedOrder.serviceType} />
                  <DrawerRow label="Criado por"  value={selectedOrder.createdBy} />
                  <DrawerRow label="Encerrada"   value={selectedOrder.closedAt ? new Date(selectedOrder.closedAt).toLocaleDateString("pt-BR") : null} />
                </DrawerSection>

                <DrawerSection title="Dados do Cliente">
                  <DrawerRow label="Nome"       value={selectedOrder.customerName} />
                  <DrawerRow label="Telefone"   value={selectedOrder.customerPhone} />
                  <DrawerRow label="CEP"        value={selectedOrder.zipCode} />
                  <DrawerRow label="Logradouro" value={selectedOrder.address} />
                  <DrawerRow label="Bairro"     value={selectedOrder.neighborhood} />
                  <DrawerRow label="Cidade"     value={selectedOrder.city} />
                  <DrawerRow label="Estado"     value={selectedOrder.state} />
                </DrawerSection>

                {(isTech || isField) && (
                  <DrawerSection title="Agendamento">
                    <DrawerRow label="Técnico"   value={selectedOrder.technician?.name} />
                    <DrawerRow label="Status"    value={STATUS_LABEL[selectedOrder.schedulingStatus]} />
                    <DrawerRow label="Data"      value={selectedOrder.scheduledDate} />
                    <DrawerRow label="Horário"   value={selectedOrder.scheduledTime} />
                    <DrawerRow label="Distância" value={selectedOrder.distanceKm != null ? `${selectedOrder.distanceKm} km` : null} />
                  </DrawerSection>
                )}

                {(selectedOrder.totalValue > 0 || selectedOrder.displacementValue != null) && (
                  <DrawerSection title="Valores">
                    {(selectedOrder.displacementValue != null || selectedOrder.distanceKm != null) && (
                      <div>
                        <span className="text-[11px] text-zinc-600">Deslocamento: </span>
                        <span className="text-[11px] text-zinc-300 font-medium">{fmt(selectedOrder.displacementValue)}</span>
                        {selectedOrder.distanceKm != null && (
                          <button onClick={() => setDisplacementDetailModal(true)} title="Ver detalhes" className="ml-1.5 text-zinc-500 hover:text-zinc-200 text-[11px]">🔍</button>
                        )}
                      </div>
                    )}
                    <DrawerRow label="Serviço"      value={fmt(selectedOrder.serviceValue)} />
                    <DrawerRow label="Total"        value={fmt(selectedOrder.totalValue)} />
                    <DrawerRow label="Aprovação">
                      {(() => {
                        const isAutoApproved = selectedOrder.financialApprovalStatus === "APROVADO" && !(selectedOrder.displacementValue > 0);
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isAutoApproved ? "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400" : FIN_COLOR[selectedOrder.financialApprovalStatus]}`}>
                            {isAutoApproved ? "Valor Padrão" : FINANCIAL_LABEL[selectedOrder.financialApprovalStatus]}
                          </span>
                        );
                      })()}
                    </DrawerRow>
                  </DrawerSection>
                )}

                {selectedOrder.observations && (
                  <DrawerSection title="Observações">
                    <p className="text-[11px] text-zinc-300 leading-relaxed">{selectedOrder.observations}</p>
                  </DrawerSection>
                )}

                {/* CORREÇÃO 1: Histórico colapsável */}
                <div className="col-span-2">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Histórico</p>
                      <button
                        onClick={() => setShowHistory(s => !s)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
                        {showHistory ? "Recolher ▲" : `Ver histórico ▼${orderAuditLog.length > 0 ? ` (${orderAuditLog.length})` : ""}`}
                      </button>
                    </div>
                    {showHistory && (
                      <div className="space-y-1.5">
                        {auditLogLoading && <p className="text-[11px] text-zinc-500">Carregando...</p>}
                        {!auditLogLoading && orderAuditLog.length === 0 && (
                          <p className="text-[11px] text-zinc-600">Nenhuma alteração registrada</p>
                        )}
                        {!auditLogLoading && orderAuditLog.map(l => (
                          <div key={l.id} className="flex items-start gap-2 py-1.5 border-b border-zinc-900 last:border-0">
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ACTION_COLOR[l.action] || "bg-zinc-800 text-zinc-400"}`}>
                              {ACTION_LABEL[l.action] || l.action}
                            </span>
                            <div className="min-w-0 flex-1">
                              {l.field && <span className="text-[10px] text-zinc-500">{l.field}: </span>}
                              {l.oldValue && <span className="text-[10px] text-red-400 line-through mr-1">{l.oldValue}</span>}
                              {l.newValue && <span className="text-[10px] text-green-400">{l.newValue}</span>}
                              <span className="block text-[10px] text-zinc-600 mt-0.5">
                                {l.performedBy} · {l.performedAt ? new Date(l.performedAt).toLocaleString("pt-BR") : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Drawer footer */}
            <div className="border-t border-zinc-800 p-4 flex flex-wrap gap-2">

              {isTech && selectedOrder.schedulingStatus !== "CONCLUIDO" && (
                <button onClick={() => openEdit(selectedOrder)}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200">
                  Marcar Agendamento
                </button>
              )}

              {/* BUG 4: Editar só quando canEdit() */}
              {canEdit(selectedOrder) && (
                <button onClick={() => openEdit(selectedOrder)}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
                  <Pencil size={13} /> Editar
                </button>
              )}

              {/* BUG 2: Aprovar/Reprovar para FIELD, OPERATOR e ADMIN */}
              {isField && !isTech && selectedOrder.financialApprovalStatus === "PENDENTE" && (selectedOrder.displacementValue ?? 0) > 0 && (
                <>
                  <button onClick={() => handleFinancial(selectedOrder.id, "APROVADO")}
                    className="rounded-xl px-4 py-2 text-sm bg-green-200 text-green-800 border border-green-300 hover:bg-green-300 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30 dark:hover:bg-green-500/20">
                    ✓ Aprovar Desl.
                  </button>
                  <button onClick={() => handleFinancial(selectedOrder.id, "REPROVADO")}
                    className="rounded-xl px-4 py-2 text-sm bg-red-200 text-red-800 border border-red-300 hover:bg-red-300 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/20">
                    ✗ Reprovar
                  </button>
                </>
              )}

              {canConcluir(selectedOrder) && !selectedOrder.completionConfirmed && (
                <button onClick={() => handleConcluir(selectedOrder.id)}
                  className="rounded-xl px-4 py-2 text-sm bg-teal-200 text-teal-800 border border-teal-300 hover:bg-teal-300 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/30 dark:hover:bg-teal-500/20">
                  Concluir
                </button>
              )}

              {canDelete(selectedOrder) && (
                <button onClick={() => handleDelete(selectedOrder)}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/10 ml-auto">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

          </div>
        </>
      )}

      {/* Confirm completion — veículo com sinal */}
      {confirmModal?.type === "completion" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Confirmar Conclusão</h2>
            <p className="text-sm text-zinc-400">Confirmar a conclusão desta OS?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
                Cancelar
              </button>
              <button onClick={handleConfirmCompletion}
                className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-500">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal — veículo sem sinal */}
      {confirmModal?.type === "no-signal" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-yellow-500/30 bg-zinc-950 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-yellow-400">⚠ Veículo sem sinal</h2>
            <p className="text-sm text-zinc-400">
              O veículo não está posicionando (última comunicação há mais de 24h). Deseja concluir mesmo assim?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
                Cancelar
              </button>
              <button onClick={handleConfirmCompletion}
                className="rounded-xl bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-500">
                Concluir assim mesmo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal deslocamento (TECH) */}
      {displacementModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-yellow-500/30 bg-zinc-950 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-yellow-400">⚠️ Taxa de Deslocamento</h2>
            <div className="space-y-1.5 text-sm text-zinc-300">
              <p>Distância calculada: <span className="font-semibold text-white">{displacementModal.km} km</span> (ida + volta)</p>
              <p>Franquia gratuita: <span className="font-semibold text-white">40 km</span></p>
              <p>Excedente: <span className="font-semibold text-white">{(displacementModal.km - 40).toFixed(1)} km × R$1,20 = <span className="text-yellow-400">R${displacementModal.displacement.toFixed(2)}</span></span></p>
            </div>
            <p className="text-sm text-zinc-400">Deseja confirmar o agendamento com essa taxa?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDisplacementModal(null)}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
                Cancelar
              </button>
              <button onClick={displacementModal.onConfirm}
                className="rounded-xl bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-500">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalhes do deslocamento */}
      {displacementDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-6 space-y-3">
            <h2 className="text-base font-bold text-white">Detalhes do Deslocamento</h2>
            <div className="space-y-2 text-sm">
              {selectedOrder.technicianAddress && (
                <div><span className="text-zinc-500">Origem: </span><span className="text-zinc-200">{selectedOrder.technicianAddress}</span></div>
              )}
              {selectedOrder.clientAddress && (
                <div><span className="text-zinc-500">Destino: </span><span className="text-zinc-200">{selectedOrder.clientAddress}</span></div>
              )}
              <div><span className="text-zinc-500">Distância total: </span><span className="text-zinc-200">{selectedOrder.distanceKm} km</span></div>
              <div><span className="text-zinc-500">Franquia: </span><span className="text-zinc-200">40 km grátis</span></div>
              {selectedOrder.distanceKm > 40 && (
                <div>
                  <span className="text-zinc-500">Excedente: </span>
                  <span className="text-zinc-200">{(selectedOrder.distanceKm - 40).toFixed(1)} km × R$1,20 = </span>
                  <span className="text-yellow-400 font-semibold">R${((selectedOrder.distanceKm - 40) * 1.20).toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setDisplacementDetailModal(false)}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL NOVA OS ====== */}
      {modal?.type === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nova Ordem de Serviço</h2>
              <button onClick={() => setModal(null)}><X size={20} className="text-zinc-400" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Placa">
                <input value={modal.form.plate ?? ""} onChange={e => setForm(f => ({...f, plate: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Chassi">
                <input value={modal.form.chassis ?? ""} onChange={e => setForm(f => ({...f, chassis: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Equipamento">
                <input value={modal.form.equipment ?? ""} onChange={e => setForm(f => ({...f, equipment: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Tipo de Serviço">
                <select value={modal.form.serviceType} onChange={e => setForm(f => ({...f, serviceType: e.target.value}))} className={INPUT}>
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Solicitante" span={2}>
                <input value={modal.form.requestedBy ?? ""} onChange={e => setForm(f => ({...f, requestedBy: e.target.value}))} className={INPUT} />
              </Field>
              <Field label={<>CEP{cepLoading && <span className="text-zinc-500 font-normal ml-1">(buscando...)</span>}</>}>
                <input value={modal.form.zipCode ?? ""} maxLength={9} placeholder="00000-000"
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => ({...f, zipCode: v}));
                    if (v.replace(/\D/g, "").length === 8) handleCepLookup(v);
                  }} className={INPUT} />
              </Field>
              <Field label="Logradouro" span={2}>
                <input value={modal.form.address ?? ""} onChange={e => setForm(f => ({...f, address: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Bairro">
                <input value={modal.form.neighborhood ?? ""} onChange={e => setForm(f => ({...f, neighborhood: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Cidade">
                <input value={modal.form.city ?? ""} onChange={e => setForm(f => ({...f, city: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Estado">
                <input value={modal.form.state ?? ""} onChange={e => setForm(f => ({...f, state: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Nome do Cliente" span={2}>
                <input value={modal.form.customerName ?? ""} onChange={e => setForm(f => ({...f, customerName: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Telefone">
                <input value={modal.form.customerPhone ?? ""} onChange={e => setForm(f => ({...f, customerPhone: e.target.value}))} className={INPUT} />
              </Field>
              <Field label="Observações" span={3}>
                <textarea value={modal.form.observations ?? ""} onChange={e => setForm(f => ({...f, observations: e.target.value}))} rows={2} className={INPUT} />
              </Field>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Cancelar</button>
              <button onClick={handleSaveCreate} className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200">Criar OS</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL EDITAR OS ====== */}
      {modal?.type === "edit" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {isTech ? "Agendamento" : "Editar Ordem de Serviço"}
              </h2>
              <button onClick={() => setModal(null)}><X size={20} className="text-zinc-400" /></button>
            </div>

            {isTech ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Dados do Operador</p>
                  <ReadField label="Placa"          value={modal.form._plate} />
                  <ReadField label="Equipamento"    value={modal.form._equipment} />
                  <ReadField label="Tipo de Serviço"value={modal.form._serviceType} />
                  <ReadField label="Cliente"        value={modal.form._customerName} />
                  <ReadField label="Telefone"       value={modal.form._customerPhone} />
                  <ReadField label="Endereço"       value={modal.form._address} />
                  <ReadField label="Cidade"         value={modal.form._city} />
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Agendamento</p>
                  <Field label="Técnico">
                    <select value={modal.form.technicianId} onChange={e => setForm(f => ({...f, technicianId: e.target.value}))} className={INPUT}>
                      <option value="">— Selecionar —</option>
                      {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Data Agendamento">
                    <input type="date" value={modal.form.scheduledDate} onChange={e => setForm(f => ({...f, scheduledDate: e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Horário">
                    <input type="time" value={modal.form.scheduledTime} onChange={e => setForm(f => ({...f, scheduledTime: e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Valor do Serviço (R$)">
                    <input type="number" value={modal.form.serviceValue} onChange={e => setForm(f => ({...f, serviceValue: e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Observações">
                    <textarea value={modal.form.observations} onChange={e => setForm(f => ({...f, observations: e.target.value}))} rows={3} className={INPUT} />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {!isTech && (
                  <>
                    <Field label="Placa">
                      <input value={modal.form.plate} onChange={e => setForm(f => ({...f, plate: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Chassi">
                      <input value={modal.form.chassis} onChange={e => setForm(f => ({...f, chassis: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Equipamento">
                      <input value={modal.form.equipment} onChange={e => setForm(f => ({...f, equipment: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Tipo de Serviço">
                      <select value={modal.form.serviceType} onChange={e => setForm(f => ({...f, serviceType: e.target.value}))} className={INPUT}>
                        {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                  </>
                )}
                {isField && (
                  <>
                    <Field label="Nome do Cliente">
                      <input value={modal.form.customerName} onChange={e => setForm(f => ({...f, customerName: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Telefone">
                      <input value={modal.form.customerPhone} onChange={e => setForm(f => ({...f, customerPhone: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label={<>CEP{cepLoading && <span className="text-zinc-500 font-normal ml-1">(buscando...)</span>}</>}>
                      <input value={modal.form.zipCode} maxLength={9} placeholder="00000-000"
                        onChange={e => {
                          const v = e.target.value;
                          setForm(f => ({...f, zipCode: v}));
                          if (v.replace(/\D/g, "").length === 8) handleCepLookup(v);
                        }} className={INPUT} />
                    </Field>
                    <Field label="Bairro">
                      <input value={modal.form.neighborhood} onChange={e => setForm(f => ({...f, neighborhood: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Logradouro" span={2}>
                      <input value={modal.form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Cidade">
                      <input value={modal.form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Estado">
                      <input value={modal.form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} className={INPUT} />
                    </Field>
                  </>
                )}
                {isOp && (
                  <Field label="Solicitante">
                    <input value={modal.form.requestedBy} onChange={e => setForm(f => ({...f, requestedBy: e.target.value}))} className={INPUT} />
                  </Field>
                )}
                {isOp && (
                  <>
                    <Field label="Técnico" span={2}>
                      <select value={modal.form.technicianId} onChange={e => setForm(f => ({...f, technicianId: e.target.value}))} className={INPUT}>
                        <option value="">— Selecionar —</option>
                        {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select value={modal.form.schedulingStatus} onChange={e => setForm(f => ({...f, schedulingStatus: e.target.value}))} className={INPUT}>
                        {SCHEDULING_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </Field>
                    <Field label="Data Agendamento">
                      <input type="date" value={modal.form.scheduledDate} onChange={e => setForm(f => ({...f, scheduledDate: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Horário">
                      <input type="time" value={modal.form.scheduledTime} onChange={e => setForm(f => ({...f, scheduledTime: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Valor do Serviço (R$)">
                      <input type="number" value={modal.form.serviceValue} onChange={e => setForm(f => ({...f, serviceValue: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Valor de Deslocamento (R$)">
                      <input type="number" value={modal.form.displacementValue} onChange={e => setForm(f => ({...f, displacementValue: e.target.value}))} className={INPUT} />
                    </Field>
                  </>
                )}
                <Field label="Observações" span={2}>
                  <textarea value={modal.form.observations} onChange={e => setForm(f => ({...f, observations: e.target.value}))} rows={2} className={INPUT} />
                </Field>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Cancelar</button>
              <button onClick={handleSaveEdit} className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
