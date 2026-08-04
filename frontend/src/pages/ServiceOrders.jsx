import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
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
  serviceType: "INSTALACAO", zipCode: "", address: "", neighborhood: "",
  city: "", state: "", customerName: "", customerPhone: "", observations: "",
};

function fmt(v) {
  return v != null ? `R$ ${Number(v).toFixed(2)}` : null;
}

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

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="min-w-0">
      <span className="text-zinc-600 text-[11px]">{label} </span>
      <span className="text-zinc-300 text-[11px] font-medium">{value}</span>
    </div>
  );
}

function Section({ title, cols = 4, children }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{title}</p>
      <div className="grid gap-x-6 gap-y-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {children}
      </div>
    </div>
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

const INPUT = "w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none";

async function fetchCep(cep) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch { return null; }
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
  const [cepLoading, setCepLoading] = useState(false);

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

  // --- open modals ---
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
      },
    });
  }

  // --- handlers ---
  async function handleSaveCreate() {
    try {
      const { zipCode, ...payload } = modal.form;
      await createServiceOrder({ ...payload, zipCode });
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
        scheduledDate: f.scheduledDate || null,
        scheduledTime: f.scheduledTime || null,
        serviceValue: f.serviceValue ? Number(f.serviceValue) : null,
        displacementValue: f.displacementValue ? Number(f.displacementValue) : null,
        observations: f.observations || null,
      };
      if (f.technicianId) schedPayload.technicianId = f.technicianId;

      if (isTech) {
        await updateScheduling(modal.id, schedPayload);
      } else if (!isOp) {
        // FIELD — base fields only
        await updateServiceOrder(modal.id, basePayload);
      } else {
        // OP/ADMIN — both
        await updateServiceOrder(modal.id, basePayload);
        await updateScheduling(modal.id, schedPayload);
      }
      toast.success("OS atualizada");
      setModal(null);
      load();
    } catch { toast.error("Erro ao salvar"); }
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

  async function handleDelete(o) {
    if (!confirm(`Excluir OS de ${o.customerName || o.plate || "?"}? Esta ação não pode ser desfeita.`)) return;
    try { await deleteServiceOrder(o.id); toast.success("OS excluída"); load(); }
    catch { toast.error("Erro ao excluir"); }
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
            <option value="PEND_CONF">Pend. Confirmação</option>
          </select>
          {isField && (
            <button onClick={openCreate}
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200">
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
            {loading && <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-500">Carregando...</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-500">Nenhuma OS encontrada</td></tr>}
            {visible.map((o) => {
              const isExp = expanded.has(o.id);
              return (
                <>
                  <tr key={o.id}
                    className={`border-b border-zinc-900 transition-colors ${isExp ? "bg-blue-950/30" : "hover:bg-zinc-900/30"}`}>
                    <td className="px-2 py-3">
                      <button onClick={() => toggleExpand(o.id)} className="text-zinc-500 hover:text-white">
                        {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{o.requestedBy || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{o.requestedAt ? new Date(o.requestedAt).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3"><SlaChip days={o.slaDays} isLate={o.late} /></td>
                    <td className="px-4 py-3 font-mono font-semibold">{o.plate || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{o.serviceType}</td>
                    <td className="px-4 py-3 text-zinc-400">{o.technician?.name || <span className="text-zinc-600">—</span>}</td>
                    <td className="px-4 py-3"><Badge label={STATUS_LABEL[o.schedulingStatus]} colorClass={STATUS_COLOR[o.schedulingStatus]} /></td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${FIN_COLOR[o.financialApprovalStatus]}`}>
                        {FINANCIAL_LABEL[o.financialApprovalStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap items-center">
                        {(isField || isTech) && o.schedulingStatus !== "CONCLUIDO" && (
                          <button onClick={() => openEdit(o)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Editar">
                            <Pencil size={13} />
                          </button>
                        )}
                        {isOp && o.completionAlertSent && !o.completionConfirmed && (
                          <button onClick={() => handleConfirmCompletion(o.id)}
                            className="rounded-lg px-2 py-1 text-xs bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20">
                            Confirmar
                          </button>
                        )}
                        {canDelete(o) && (
                          <button onClick={() => handleDelete(o)}
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10" title="Excluir">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExp && (
                    <tr key={`${o.id}-exp`} className="border-b border-zinc-900 bg-blue-950/10">
                      <td />
                      <td colSpan={9} className="px-5 py-3">
                        <div className="space-y-3">

                          <Section title="📋 Dados do Serviço" cols={5}>
                            <InfoRow label="Solicitante" value={o.requestedBy} />
                            <InfoRow label="Data" value={o.requestedAt ? new Date(o.requestedAt).toLocaleDateString("pt-BR") : null} />
                            <InfoRow label="Tipo" value={o.serviceType} />
                            <InfoRow label="Equipamento" value={o.equipment} />
                            <InfoRow label="SLA" value={`${o.slaDays}d${o.late ? " ⚠" : ""}`} />
                            <InfoRow label="Chassi" value={o.chassis} />
                            <InfoRow label="Criado por" value={o.createdBy} />
                            <InfoRow label="Encerrada" value={o.closedAt ? new Date(o.closedAt).toLocaleDateString("pt-BR") : null} />
                          </Section>

                          <Section title="📍 Endereço do Cliente" cols={4}>
                            <InfoRow label="Nome" value={o.customerName} />
                            <InfoRow label="Contato" value={o.customerPhone} />
                            <InfoRow label="CEP" value={o.zipCode} />
                            <InfoRow label="Logradouro" value={o.address} />
                            <InfoRow label="Bairro" value={o.neighborhood} />
                            <InfoRow label="Cidade" value={o.city} />
                            <InfoRow label="Estado" value={o.state} />
                          </Section>

                          {(isTech || isOp) && (
                            <Section title="🔧 Agendamento" cols={4}>
                              <InfoRow label="Técnico" value={o.technician?.name} />
                              <InfoRow label="Status" value={STATUS_LABEL[o.schedulingStatus]} />
                              <InfoRow label="Data" value={o.scheduledDate} />
                              <InfoRow label="Horário" value={o.scheduledTime} />
                              <InfoRow label="Distância" value={o.distanceKm != null ? `${o.distanceKm} km` : null} />
                            </Section>
                          )}

                          {o.totalValue > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">💰 Valores</p>
                              <div className="grid grid-cols-4 gap-x-6 gap-y-0.5">
                                <InfoRow label="Deslocamento" value={fmt(o.displacementValue)} />
                                <InfoRow label="Serviço" value={fmt(o.serviceValue)} />
                                <InfoRow label="Total" value={fmt(o.totalValue)} />
                              </div>
                              {isOp && o.financialApprovalStatus === "PENDENTE" && (
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => handleFinancial(o.id, "APROVADO")} className="rounded-lg px-3 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20">✓ Aprovar</button>
                                  <button onClick={() => handleFinancial(o.id, "REPROVADO")} className="rounded-lg px-3 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">✗ Reprovar</button>
                                </div>
                              )}
                            </div>
                          )}

                          {o.observations && (
                            <div>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">📝 Observações</p>
                              <p className="text-[11px] text-zinc-300">{o.observations}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
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
              {[["plate","Placa",1],["chassis","Chassi",1],["equipment","Equipamento",1]].map(([key,label,span]) => (
                <Field key={key} label={label} span={span}>
                  <input value={modal.form[key] ?? ""} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} className={INPUT} />
                </Field>
              ))}
              <Field label="Tipo de Serviço">
                <select value={modal.form.serviceType} onChange={e => setForm(f => ({...f,serviceType:e.target.value}))} className={INPUT}>
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label={<>CEP {cepLoading && <span className="text-zinc-500 font-normal">(buscando...)</span>}</>}>
                <input value={modal.form.zipCode ?? ""} maxLength={9} placeholder="00000-000"
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => ({...f, zipCode: v}));
                    if (v.replace(/\D/g,"").length === 8) handleCepLookup(v);
                  }}
                  className={INPUT} />
              </Field>
              {[["address","Logradouro",2],["neighborhood","Bairro",1],["city","Cidade",1],["state","Estado",1]].map(([key,label,span]) => (
                <Field key={key} label={label} span={span}>
                  <input value={modal.form[key] ?? ""} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} className={INPUT} />
                </Field>
              ))}
              {[["customerName","Nome do Cliente",2],["customerPhone","Telefone",1]].map(([key,label,span]) => (
                <Field key={key} label={label} span={span}>
                  <input value={modal.form[key] ?? ""} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} className={INPUT} />
                </Field>
              ))}
              <Field label="Observações" span={2}>
                <textarea value={modal.form.observations ?? ""} onChange={e => setForm(f => ({...f,observations:e.target.value}))} rows={2} className={INPUT} />
              </Field>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Cancelar</button>
              <button onClick={handleSaveCreate} className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200">Criar OS</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar OS */}
      {modal?.type === "edit" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editar Ordem de Serviço</h2>
              <button onClick={() => setModal(null)}><X size={20} className="text-zinc-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* FIELD + OP/ADMIN: dados do serviço */}
              {!isTech && (
                <>
                  <Field label="Placa">
                    <input value={modal.form.plate} onChange={e => setForm(f => ({...f,plate:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Chassi">
                    <input value={modal.form.chassis} onChange={e => setForm(f => ({...f,chassis:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Equipamento">
                    <input value={modal.form.equipment} onChange={e => setForm(f => ({...f,equipment:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Tipo de Serviço">
                    <select value={modal.form.serviceType} onChange={e => setForm(f => ({...f,serviceType:e.target.value}))} className={INPUT}>
                      {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </>
              )}

              {/* OP/ADMIN: address + customer */}
              {isOp && (
                <>
                  <Field label={<>CEP {cepLoading && <span className="text-zinc-500 font-normal">(buscando...)</span>}</>}>
                    <input value={modal.form.zipCode} maxLength={9} placeholder="00000-000"
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => ({...f, zipCode: v}));
                        if (v.replace(/\D/g,"").length === 8) handleCepLookup(v);
                      }}
                      className={INPUT} />
                  </Field>
                  <Field label="Solicitante">
                    <input value={modal.form.requestedBy} onChange={e => setForm(f => ({...f,requestedBy:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Logradouro" span={2}>
                    <input value={modal.form.address} onChange={e => setForm(f => ({...f,address:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Bairro">
                    <input value={modal.form.neighborhood} onChange={e => setForm(f => ({...f,neighborhood:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Cidade">
                    <input value={modal.form.city} onChange={e => setForm(f => ({...f,city:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Estado">
                    <input value={modal.form.state} onChange={e => setForm(f => ({...f,state:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Nome do Cliente">
                    <input value={modal.form.customerName} onChange={e => setForm(f => ({...f,customerName:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Telefone">
                    <input value={modal.form.customerPhone} onChange={e => setForm(f => ({...f,customerPhone:e.target.value}))} className={INPUT} />
                  </Field>
                </>
              )}

              {/* TECH + OP/ADMIN: scheduling */}
              {(isTech || isOp) && (
                <>
                  {isOp && (
                    <Field label="Técnico" span={2}>
                      <select value={modal.form.technicianId} onChange={e => setForm(f => ({...f,technicianId:e.target.value}))} className={INPUT}>
                        <option value="">— Selecionar —</option>
                        {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </Field>
                  )}
                  {isOp && (
                    <Field label="Status">
                      <select value={modal.form.schedulingStatus} onChange={e => setForm(f => ({...f,schedulingStatus:e.target.value}))} className={INPUT}>
                        {SCHEDULING_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Data Agendamento">
                    <input type="date" value={modal.form.scheduledDate} onChange={e => setForm(f => ({...f,scheduledDate:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Horário">
                    <input type="time" value={modal.form.scheduledTime} onChange={e => setForm(f => ({...f,scheduledTime:e.target.value}))} className={INPUT} />
                  </Field>
                  <Field label="Valor do Serviço (R$)">
                    <input type="number" value={modal.form.serviceValue} onChange={e => setForm(f => ({...f,serviceValue:e.target.value}))} className={INPUT} />
                  </Field>
                  {isOp && (
                    <Field label="Valor de Deslocamento (R$)">
                      <input type="number" value={modal.form.displacementValue} onChange={e => setForm(f => ({...f,displacementValue:e.target.value}))} className={INPUT} />
                    </Field>
                  )}
                </>
              )}

              <Field label="Observações" span={2}>
                <textarea value={modal.form.observations} onChange={e => setForm(f => ({...f,observations:e.target.value}))} rows={2} className={INPUT} />
              </Field>
            </div>

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
