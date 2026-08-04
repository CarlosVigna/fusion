import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  getServiceOrders,
  createServiceOrder,
  updateScheduling,
  updateFinancialApproval,
  confirmCompletion,
} from "../services/serviceOrderService";
import { getTechnicians } from "../services/technicianService";
import { useAuthStore } from "../store/authStore";

const STATUS_LABEL = { ABERTO: "Aberto", AGENDADO: "Agendado", CONCLUIDO: "Concluído" };
const FINANCIAL_LABEL = { PENDENTE: "Pendente", APROVADO: "Aprovado", REPROVADO: "Reprovado" };
const STATUS_COLOR = {
  ABERTO:   "bg-blue-500/10 text-blue-400 border-blue-500/30",
  AGENDADO: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  CONCLUIDO:"bg-green-500/10 text-green-400 border-green-500/30",
};
const FIN_COLOR = {
  PENDENTE:  "bg-zinc-800 text-zinc-400",
  APROVADO:  "bg-green-500/10 text-green-400",
  REPROVADO: "bg-red-500/10 text-red-400",
};

const SERVICE_TYPES = ["INSTALACAO", "TROCA", "MANUTENCAO"];
const SCHEDULING_STATUSES = ["ABERTO", "AGENDADO", "CONCLUIDO"];

const EMPTY_ORDER = {
  requestedBy: "", plate: "", chassis: "", equipment: "LUMINI",
  serviceType: "INSTALACAO", city: "", address: "", customerName: "",
  customerPhone: "", observations: "",
};

function fmt(v) {
  if (v == null) return "—";
  return `R$ ${Number(v).toFixed(2)}`;
}

function Badge({ label, colorClass }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${colorClass}`}>{label}</span>;
}

function SlaChip({ days, isLate }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isLate ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-400"}`}>
      {days}d {isLate ? "⚠" : ""}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-4">{children}</div>
    </div>
  );
}

function Field({ label, value, wide }) {
  if (!value && value !== 0) return null;
  return (
    <div style={wide ? { gridColumn: "span 4" } : {}}>
      <span className="text-zinc-600 text-xs">{label}: </span>
      <span className="text-zinc-300 text-xs">{value}</span>
    </div>
  );
}

export default function ServiceOrders() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const role = user?.role;
  const isAdmin = role === "ADMIN";
  const isOp    = role === "OPERATOR" || isAdmin;
  const isField = role === "FIELD" || isOp;
  const isTech  = role === "TECHNICIAN";

  const [orders, setOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [filter, setFilter] = useState(searchParams.get("filter") || "");
  const [modal, setModal] = useState(null);

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

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function applyFilter(list) {
    switch (filter) {
      case "ABERTO":    return list.filter(o => o.schedulingStatus === "ABERTO");
      case "AGENDADO":  return list.filter(o => o.schedulingStatus === "AGENDADO");
      case "LATE":      return list.filter(o => o.late);
      case "PEND_FIN":  return list.filter(o => o.schedulingStatus !== "CONCLUIDO" && o.financialApprovalStatus === "PENDENTE");
      case "PEND_CONF": return list.filter(o => o.completionAlertSent && !o.completionConfirmed);
      default: return list;
    }
  }

  const visible = applyFilter(orders);

  function openCreate() { setModal({ type: "create", form: { ...EMPTY_ORDER } }); }

  function openScheduling(o) {
    setModal({
      type: "scheduling", id: o.id,
      form: {
        technicianId: o.technician?.id || "",
        schedulingStatus: o.schedulingStatus,
        scheduledDate: o.scheduledDate || "",
        scheduledTime: o.scheduledTime || "",
        serviceValue: o.serviceValue || "",
        observations: o.observations || "",
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

  async function handleSaveScheduling() {
    try {
      const payload = { ...modal.form };
      if (!payload.technicianId) delete payload.technicianId;
      await updateScheduling(modal.id, payload);
      toast.success("Agendamento salvo");
      setModal(null);
      load();
    } catch { toast.error("Erro ao salvar agendamento"); }
  }

  async function handleFinancial(id, status) {
    try { await updateFinancialApproval(id, status); toast.success("Aprovação atualizada"); load(); }
    catch { toast.error("Erro"); }
  }

  async function handleConfirmCompletion(id) {
    if (!confirm("Confirmar conclusão desta OS?")) return;
    try { await confirmCompletion(id); toast.success("Conclusão confirmada"); load(); }
    catch { toast.error("Erro"); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
          <p className="text-zinc-400 mt-1">{visible.length} ordem(ns)</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="ABERTO">Abertas</option>
            <option value="AGENDADO">Agendadas</option>
            <option value="LATE">Atrasadas</option>
            <option value="PEND_FIN">Pend. Aprovação</option>
            <option value="PEND_CONF">Pend. Confirmação</option>
          </select>
          {isField && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              <Plus size={16} /> Nova Ordem
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <th className="w-8 px-2" />
              <th className="px-4 py-3">Solicitante</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3">Técnico</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aprovação</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-500">Carregando...</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-500">Nenhuma OS encontrada</td></tr>
            )}
            {visible.map((o) => (
              <>
                <tr key={o.id} className="border-b border-zinc-900 hover:bg-zinc-900/30">
                  <td className="px-2 py-3">
                    <button onClick={() => toggleExpand(o.id)} className="text-zinc-500 hover:text-white">
                      {expanded.has(o.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{o.requestedBy || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{o.requestedAt ? new Date(o.requestedAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3"><SlaChip days={o.slaDays} isLate={o.late} /></td>
                  <td className="px-4 py-3 font-mono font-semibold">{o.plate}</td>
                  <td className="px-4 py-3 text-zinc-400">{o.serviceType}</td>
                  <td className="px-4 py-3 text-zinc-400">{o.technician?.name || <span className="text-zinc-600">—</span>}</td>
                  <td className="px-4 py-3"><Badge label={STATUS_LABEL[o.schedulingStatus]} colorClass={STATUS_COLOR[o.schedulingStatus]} /></td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${FIN_COLOR[o.financialApprovalStatus]}`}>
                      {FINANCIAL_LABEL[o.financialApprovalStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(isTech || isOp) && o.schedulingStatus !== "CONCLUIDO" && (
                        <button onClick={() => openScheduling(o)} className="rounded-lg px-2 py-1 text-xs border border-zinc-700 hover:bg-zinc-800">Agendar</button>
                      )}
                      {isOp && o.completionAlertSent && !o.completionConfirmed && (
                        <button onClick={() => handleConfirmCompletion(o.id)} className="rounded-lg px-2 py-1 text-xs bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20">Confirmar</button>
                      )}
                    </div>
                  </td>
                </tr>

                {expanded.has(o.id) && (
                  <tr key={`${o.id}-exp`} className="border-b border-zinc-900 bg-zinc-950">
                    <td />
                    <td colSpan={9} className="px-6 py-5">
                      <div className="space-y-5">

                        {/* DADOS DO SERVIÇO */}
                        <Section title="📋 Dados do Serviço">
                          <Field label="Solicitante" value={o.requestedBy} />
                          <Field label="Data" value={o.requestedAt ? new Date(o.requestedAt).toLocaleDateString("pt-BR") : null} />
                          <Field label="Tipo de Serviço" value={o.serviceType} />
                          <Field label="Equipamento" value={o.equipment} />
                          <Field label="Chassi" value={o.chassis} />
                          <Field label="SLA" value={`${o.slaDays}d${o.late ? " ⚠ Atrasada" : ""}`} />
                          <Field label="Criado por" value={o.createdBy} />
                          <Field label="Encerrada" value={o.closedAt ? new Date(o.closedAt).toLocaleString("pt-BR") : null} />
                        </Section>

                        {/* ENDEREÇO DO CLIENTE */}
                        <Section title="📍 Endereço do Cliente">
                          <Field label="Nome" value={o.customerName} />
                          <Field label="Contato" value={o.customerPhone} />
                          <Field label="Endereço" value={o.address} />
                          <Field label="Bairro" value={o.neighborhood} />
                          <Field label="Cidade" value={o.city} />
                          <Field label="Estado" value={o.state} />
                        </Section>

                        {/* AGENDAMENTO — só TECHNICIAN/OPERATOR/ADMIN */}
                        {(isTech || isOp) && (
                          <Section title="🔧 Agendamento">
                            <Field label="Técnico" value={o.technician?.name} />
                            <Field label="Status" value={STATUS_LABEL[o.schedulingStatus]} />
                            <Field label="Data Agendada" value={o.scheduledDate || null} />
                            <Field label="Horário" value={o.scheduledTime || null} />
                            <Field label="Distância" value={o.distanceKm != null ? `${o.distanceKm} km` : null} />
                          </Section>
                        )}

                        {/* VALORES — só quando totalValue > 0 */}
                        {o.totalValue > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">💰 Valores</p>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-4">
                              <Field label="Valor de Deslocamento" value={fmt(o.displacementValue)} />
                              <Field label="Valor do Serviço" value={fmt(o.serviceValue)} />
                              <Field label="Valor Total" value={fmt(o.totalValue)} />
                            </div>
                            {isOp && o.financialApprovalStatus === "PENDENTE" && (
                              <div className="flex gap-2 mt-3">
                                <button onClick={() => handleFinancial(o.id, "APROVADO")} className="rounded-lg px-3 py-1.5 text-xs bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20">✓ Aprovar</button>
                                <button onClick={() => handleFinancial(o.id, "REPROVADO")} className="rounded-lg px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">✗ Reprovar</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* OBSERVAÇÕES */}
                        {o.observations && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">📝 Observações</p>
                            <p className="text-xs text-zinc-300">{o.observations}</p>
                          </div>
                        )}

                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nova OS */}
      {modal?.type === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nova Ordem de Serviço</h2>
              <button onClick={() => setModal(null)}><X size={20} className="text-zinc-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["requestedBy","Solicitante",1],["plate","Placa *",1],
                ["chassis","Chassi",1],["equipment","Equipamento",1],
                ["customerName","Nome do Cliente",2],["customerPhone","Telefone",1],
                ["city","Cidade",1],["address","Endereço",2],
              ].map(([key, label, span]) => (
                <div key={key} style={{ gridColumn: `span ${span}` }}>
                  <label className="block text-xs text-zinc-400 mb-1">{label}</label>
                  <input
                    value={modal.form[key] ?? ""}
                    onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, [key]: e.target.value } }))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Tipo de Serviço</label>
                <select
                  value={modal.form.serviceType}
                  onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, serviceType: e.target.value } }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-xs text-zinc-400 mb-1">Observações</label>
                <textarea
                  value={modal.form.observations ?? ""}
                  onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, observations: e.target.value } }))}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Cancelar</button>
              <button onClick={handleSaveCreate} className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200">Criar OS</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agendamento */}
      {modal?.type === "scheduling" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Agendamento</h2>
              <button onClick={() => setModal(null)}><X size={20} className="text-zinc-400" /></button>
            </div>
            <div className="space-y-3">
              {isOp && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Técnico</label>
                  <select
                    value={modal.form.technicianId}
                    onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, technicianId: e.target.value } }))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">— Selecionar —</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {isOp && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Status</label>
                  <select
                    value={modal.form.schedulingStatus}
                    onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, schedulingStatus: e.target.value } }))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {SCHEDULING_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Data</label>
                  <input
                    type="date"
                    value={modal.form.scheduledDate}
                    onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, scheduledDate: e.target.value } }))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Horário</label>
                  <input
                    type="time"
                    value={modal.form.scheduledTime}
                    onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, scheduledTime: e.target.value } }))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Valor do Serviço (R$)</label>
                <input
                  type="number"
                  value={modal.form.serviceValue}
                  onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, serviceValue: e.target.value } }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Observações</label>
                <textarea
                  value={modal.form.observations}
                  onChange={(e) => setModal((p) => ({ ...p, form: { ...p.form, observations: e.target.value } }))}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Cancelar</button>
              <button onClick={handleSaveScheduling} className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
