import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  getServiceOrders,
  createServiceOrder,
  updateServiceOrder,
  updateScheduling,
  updateFinancialApproval,
  confirmCompletion,
  deleteServiceOrder,
} from "../services/serviceOrderService";
import { getTechnicians } from "../services/technicianService";
import { useAuthStore } from "../store/authStore";

const STATUS_LABEL    = { ABERTO: "Aberto", AGENDADO: "Agendado", CONCLUIDO: "Concluído" };
const FINANCIAL_LABEL = { PENDENTE: "Pendente", APROVADO: "Aprovado", REPROVADO: "Reprovado" };
const STATUS_COLOR = {
  ABERTO:    "bg-blue-500/10 text-blue-400 border-blue-500/30",
  AGENDADO:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  CONCLUIDO: "bg-green-500/10 text-green-400 border-green-500/30",
};
const FIN_COLOR = {
  PENDENTE:  "bg-zinc-800 text-zinc-400",
  APROVADO:  "bg-green-500/10 text-green-400",
  REPROVADO: "bg-red-500/10 text-red-400",
};
const SERVICE_TYPES       = ["INSTALACAO", "TROCA", "MANUTENCAO"];
const SCHEDULING_STATUSES = ["ABERTO", "AGENDADO", "CONCLUIDO"];

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
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isLate ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-400"}`}>
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

// Drawer section component — flat vertical list for side-by-side columns
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

// Conditions for TECHNICIAN to confirm completion
function canConfirmForTech(o) {
  if (!o.technician || !o.scheduledDate || !o.scheduledTime || !o.serviceValue) return false;
  const today = new Date().toISOString().slice(0, 10);
  return o.scheduledDate <= today;
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
  const [cepLoading, setCepLoading]   = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [os, techs] = await Promise.all([getServiceOrders(), getTechnicians()]);
      setOrders(os);
      setTechnicians(techs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function applyFilter(list) {
    switch (filter) {
      case "ABERTO":   return list.filter(o => o.schedulingStatus === "ABERTO");
      case "AGENDADO": return list.filter(o => o.schedulingStatus === "AGENDADO");
      case "LATE":     return list.filter(o => o.late);
      case "PEND_FIN": return list.filter(o => o.schedulingStatus !== "CONCLUIDO" && o.financialApprovalStatus === "PENDENTE");
      default: return list;
    }
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
        // originals for tech read-only panel
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
    try {
      await createServiceOrder(modal.form);
      toast.success("OS criada");
      setModal(null);
      load();
    } catch { toast.error("Erro ao criar OS"); }
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
      const schedPayload = {
        schedulingStatus: f.schedulingStatus,
        scheduledDate:    f.scheduledDate    || null,
        scheduledTime:    f.scheduledTime    || null,
        serviceValue:     f.serviceValue     ? Number(f.serviceValue)     : null,
        displacementValue:f.displacementValue? Number(f.displacementValue): null,
        observations:     f.observations     || null,
      };
      if (f.technicianId) schedPayload.technicianId = f.technicianId;

      if (isTech) {
        await updateScheduling(modal.id, schedPayload);
      } else if (!isOp) {
        await updateServiceOrder(modal.id, basePayload);
      } else {
        await updateServiceOrder(modal.id, basePayload);
        await updateScheduling(modal.id, schedPayload);
      }
      toast.success("OS atualizada");
      setModal(null);
      setSelectedOrder(null);
      load();
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
          <p className="text-zinc-400 mt-1">{visible.length} ordem(ns)</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">Todos</option>
            <option value="ABERTO">Abertas</option>
            <option value="AGENDADO">Agendadas</option>
            <option value="LATE">Atrasadas</option>
            <option value="PEND_FIN">Pend. Aprovação</option>
          </select>
          {isField && (
            <button onClick={openCreate}
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200">
              <Plus size={16} /> Nova Ordem
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
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
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Carregando...</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Nenhuma OS encontrada</td></tr>}
            {visible.map((o) => (
              <tr key={o.id}
                onClick={() => setSelectedOrder(o)}
                className="border-b border-zinc-900 transition-colors hover:bg-zinc-900/40 cursor-pointer">
                <td className="px-4 py-3 font-mono font-semibold">{o.plate || <span className="text-zinc-600">—</span>}</td>
                <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{o.requestedAt ? new Date(o.requestedAt).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-4 py-3"><SlaChip days={o.slaDays} isLate={o.late} /></td>
                <td className="px-4 py-3 text-zinc-400">{o.serviceType}</td>
                <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                  {[o.city, o.state].filter(Boolean).join(", ") || <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell max-w-[200px] truncate">{o.address || "—"}</td>
                <td className="px-4 py-3"><Badge label={STATUS_LABEL[o.schedulingStatus]} colorClass={STATUS_COLOR[o.schedulingStatus]} /></td>
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
      </div>

      {/* ====== DRAWER LATERAL ====== */}
      {selectedOrder && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl">

            {/* Drawer header */}
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

            {/* Drawer body — 2-column grid */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">

                {/* Col 1, Row 1: Dados do Veículo */}
                <DrawerSection title="Dados do Veículo">
                  <DrawerRow label="Placa"       value={selectedOrder.plate} />
                  <DrawerRow label="Chassi"      value={selectedOrder.chassis} />
                  <DrawerRow label="Equipamento" value={selectedOrder.equipment} />
                  <DrawerRow label="SLA"         value={`${selectedOrder.slaDays}d${selectedOrder.late ? " ⚠" : ""}`} />
                </DrawerSection>

                {/* Col 2, Row 1: Dados da Solicitação */}
                <DrawerSection title="Dados da Solicitação">
                  <DrawerRow label="Solicitante" value={selectedOrder.requestedBy} />
                  <DrawerRow label="Data"        value={selectedOrder.requestedAt ? new Date(selectedOrder.requestedAt).toLocaleDateString("pt-BR") : null} />
                  <DrawerRow label="Tipo"        value={selectedOrder.serviceType} />
                  <DrawerRow label="Criado por"  value={selectedOrder.createdBy} />
                  <DrawerRow label="Encerrada"   value={selectedOrder.closedAt ? new Date(selectedOrder.closedAt).toLocaleDateString("pt-BR") : null} />
                </DrawerSection>

                {/* Col 1, Row 2: Endereço do Cliente */}
                <DrawerSection title="Endereço do Cliente">
                  <DrawerRow label="Nome"       value={selectedOrder.customerName} />
                  <DrawerRow label="Telefone"   value={selectedOrder.customerPhone} />
                  <DrawerRow label="CEP"        value={selectedOrder.zipCode} />
                  <DrawerRow label="Logradouro" value={selectedOrder.address} />
                  <DrawerRow label="Bairro"     value={selectedOrder.neighborhood} />
                  <DrawerRow label="Cidade"     value={selectedOrder.city} />
                  <DrawerRow label="Estado"     value={selectedOrder.state} />
                </DrawerSection>

                {/* Col 2, Row 2: Agendamento */}
                {(isTech || isOp) && (
                  <DrawerSection title="Agendamento">
                    <DrawerRow label="Técnico"   value={selectedOrder.technician?.name} />
                    <DrawerRow label="Status"    value={STATUS_LABEL[selectedOrder.schedulingStatus]} />
                    <DrawerRow label="Data"      value={selectedOrder.scheduledDate} />
                    <DrawerRow label="Horário"   value={selectedOrder.scheduledTime} />
                    <DrawerRow label="Distância" value={selectedOrder.distanceKm != null ? `${selectedOrder.distanceKm} km` : null} />
                  </DrawerSection>
                )}

                {/* Col 1, Row 3: Valores */}
                {(selectedOrder.totalValue > 0 || selectedOrder.displacementValue != null) && (
                  <DrawerSection title="Valores">
                    <DrawerRow label="Deslocamento" value={fmt(selectedOrder.displacementValue)} />
                    <DrawerRow label="Serviço"      value={fmt(selectedOrder.serviceValue)} />
                    <DrawerRow label="Total"        value={fmt(selectedOrder.totalValue)} />
                    <DrawerRow label="Aprovação">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${FIN_COLOR[selectedOrder.financialApprovalStatus]}`}>
                        {FINANCIAL_LABEL[selectedOrder.financialApprovalStatus]}
                      </span>
                    </DrawerRow>
                  </DrawerSection>
                )}

                {/* Col 2, Row 3: Observações */}
                {selectedOrder.observations && (
                  <DrawerSection title="Observações">
                    <p className="text-[11px] text-zinc-300 leading-relaxed">{selectedOrder.observations}</p>
                  </DrawerSection>
                )}

              </div>
            </div>

            {/* Drawer footer — role-based actions */}
            <div className="border-t border-zinc-800 p-4 flex flex-wrap gap-2">

              {/* TECHNICIAN: Marcar Agendamento + conditional Confirmar Conclusão */}
              {isTech && selectedOrder.schedulingStatus !== "CONCLUIDO" && (
                <>
                  <button onClick={() => openEdit(selectedOrder)}
                    className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200">
                    Marcar Agendamento
                  </button>
                  {canConfirmForTech(selectedOrder) && (
                    <button onClick={() => setConfirmModal({ type: "completion", orderId: selectedOrder.id })}
                      className="rounded-xl px-4 py-2 text-sm bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20">
                      Confirmar Conclusão
                    </button>
                  )}
                </>
              )}

              {/* FIELD (non-op, non-tech): Editar */}
              {isField && !isOp && !isTech && selectedOrder.schedulingStatus !== "CONCLUIDO" && (
                <button onClick={() => openEdit(selectedOrder)}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
                  <Pencil size={13} /> Editar
                </button>
              )}

              {/* OPERATOR/ADMIN: Editar + aprovação financeira + confirmar conclusão */}
              {isOp && selectedOrder.schedulingStatus !== "CONCLUIDO" && (
                <button onClick={() => openEdit(selectedOrder)}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
                  <Pencil size={13} /> Editar
                </button>
              )}
              {isOp && selectedOrder.financialApprovalStatus === "PENDENTE" && (selectedOrder.displacementValue ?? 0) > 0 && (
                <>
                  <button onClick={() => handleFinancial(selectedOrder.id, "APROVADO")}
                    className="rounded-xl px-4 py-2 text-sm bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20">
                    ✓ Aprovar Desl.
                  </button>
                  <button onClick={() => handleFinancial(selectedOrder.id, "REPROVADO")}
                    className="rounded-xl px-4 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                    ✗ Reprovar
                  </button>
                </>
              )}
              {isOp && selectedOrder.schedulingStatus !== "CONCLUIDO" && !selectedOrder.completionConfirmed && (
                <button onClick={() => setConfirmModal({ type: "completion", orderId: selectedOrder.id })}
                  className="rounded-xl px-4 py-2 text-sm bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20">
                  Confirmar Conclusão
                </button>
              )}

              {/* Delete (any role with permission) */}
              {canDelete(selectedOrder) && (
                <button onClick={() => handleDelete(selectedOrder)}
                  className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 ml-auto">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

          </div>
        </>
      )}

      {/* Confirm completion modal */}
      {confirmModal?.type === "completion" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Confirmar Conclusão</h2>
            <p className="text-sm text-zinc-400">
              Confirmar a conclusão desta OS? O sistema verificará o sinal do veículo automaticamente.
            </p>
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

            {/* TECHNICIAN: 2-column — read-only left / editable right */}
            {isTech ? (
              <div className="grid grid-cols-2 gap-6">
                {/* Left: read-only operator data */}
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
                {/* Right: editable scheduling fields */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Agendamento</p>
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
              /* FIELD / OP / ADMIN: standard grid */
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
                {isOp && (
                  <>
                    <Field label={<>CEP{cepLoading && <span className="text-zinc-500 font-normal ml-1">(buscando...)</span>}</>}>
                      <input value={modal.form.zipCode} maxLength={9} placeholder="00000-000"
                        onChange={e => {
                          const v = e.target.value;
                          setForm(f => ({...f, zipCode: v}));
                          if (v.replace(/\D/g, "").length === 8) handleCepLookup(v);
                        }} className={INPUT} />
                    </Field>
                    <Field label="Solicitante">
                      <input value={modal.form.requestedBy} onChange={e => setForm(f => ({...f, requestedBy: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Logradouro" span={2}>
                      <input value={modal.form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Bairro">
                      <input value={modal.form.neighborhood} onChange={e => setForm(f => ({...f, neighborhood: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Cidade">
                      <input value={modal.form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Estado">
                      <input value={modal.form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Nome do Cliente">
                      <input value={modal.form.customerName} onChange={e => setForm(f => ({...f, customerName: e.target.value}))} className={INPUT} />
                    </Field>
                    <Field label="Telefone">
                      <input value={modal.form.customerPhone} onChange={e => setForm(f => ({...f, customerPhone: e.target.value}))} className={INPUT} />
                    </Field>
                  </>
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
