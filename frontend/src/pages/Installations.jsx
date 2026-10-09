import { useEffect, useRef, useState } from "react";

import toast from "react-hot-toast";

import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Download,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Square,
  UserCog,
} from "lucide-react";

import {
  getServiceOrders,
  updateServiceOrder,
} from "../services/serviceOrderService";

import InstallationModal from "../components/installations/InstallationModal";

import SchedulingModal from "../components/installations/SchedulingModal";

import { formatLocalDateTime } from "../utils/dateUtils";

// Tela migrada pra trabalhar com ServiceOrder (serviceType=INSTALACAO)
// em vez da entidade Installation — abas por portalStatus (ver
// PORTAL_TABS); sem campo de modelo do veiculo; sem conceito de
// "enviado"/"cancelado"/"dispensar alerta", que ServiceOrder nao tem
// equivalente.
function buildMessage(so) {
  return (
    `*INSTALAÇÃO NOVA*\n\n` +
    `*NOME:* ${so.customerName?.toUpperCase()}\n` +
    `*ENDEREÇO:* ${so.address?.toUpperCase()} | *BAIRRO:* ${so.neighborhood?.toUpperCase()} - ${so.city?.toUpperCase()}/${so.state?.toUpperCase()}\n` +
    `*CEP:* ${so.zipCode}\n` +
    `*TELEFONE:* ${so.customerPhone}\n` +
    `*PLACA:* ${so.plate?.toUpperCase()}`
  );
}

// ServiceOrder nao tem um slaStatus pronto como Installation tinha —
// so' slaDays (dias desde requestedAt). Mesmos limiares de antes.
function slaStatusOf(so) {
  if (so.slaDays == null) return null;
  if (so.slaDays <= 1) return "SLA_OK";
  if (so.slaDays === 2) return "SLA_WARNING";
  return "SLA_CRITICAL";
}

function slaColors(slaStatus) {
  if (slaStatus === "SLA_CRITICAL") return { row: "bg-red-500/5 border-l-2 border-red-500/40", badge: "bg-red-500/15 text-red-400", dot: "bg-red-500" };
  if (slaStatus === "SLA_WARNING")  return { row: "bg-yellow-500/5 border-l-2 border-yellow-500/40", badge: "bg-yellow-500/15 text-yellow-400", dot: "bg-yellow-500" };
  return { row: "", badge: "bg-green-500/15 text-green-400", dot: "bg-green-500" };
}

function slaLabel(so) {
  if (so.slaDays == null) return "—";
  if (so.slaDays === 0) return "Hoje";
  if (so.slaDays === 1) return "1 dia";
  return `${so.slaDays} dias`;
}

// Abas espelhando os status do portal (portalStatus vem da Installation
// vinculada, preenchido em GET /service-orders). kind define a tabela:
// "active" = tabela com acoes/SLA, "done" = tabela de historico,
// "other" = OS manual sem portal / marcadores antigos (abertas usam a
// tabela com acoes, concluidas a tabela simples).
const PORTAL_TABS = [
  { key: "AGUARDANDO_AGENDAMENTO",       label: "Aguardando Agendamento", kind: "active" },
  { key: "AGENDADO_AGUARDANDO_ATIVACAO", label: "Ag. Ativação",           kind: "active" },
  { key: "AGUARDANDO_INSTALACAO",        label: "Aguardando Instalação",  kind: "active" },
  { key: "PENDENTE_INSTALACAO",          label: "Pendente",               kind: "active" },
  { key: "INSTALACAO_EM_ANALISE",        label: "Em Análise",             kind: "active" },
  { key: "INSTALACAO_ENVIADA",           label: "Enviada",                kind: "active" },
  { key: "INSTALACAO_CONCLUIDA_SUCESSO", label: "Concluída ✅",           kind: "done" },
  { key: "INSTALACAO_CONCLUIDA_FALHA",   label: "Falha ❌",               kind: "done" },
  { key: "OUTROS",                       label: "Outros",                 kind: "other" },
];

const KNOWN_PORTAL_STATUSES = new Set(PORTAL_TABS.filter((t) => t.key !== "OUTROS").map((t) => t.key));

function tabKeyOf(so) {
  return KNOWN_PORTAL_STATUSES.has(so.portalStatus) ? so.portalStatus : "OUTROS";
}

function portalStatusLabel(status) {
  if (!status) return "—";
  return PORTAL_TABS.find((t) => t.key === status)?.label ?? status;
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return String(dateStr).slice(0, 10) === today;
}

export default function Installations() {
  const [tab, setTab] = useState("AGUARDANDO_AGENDAMENTO");

  const [showNewModal, setShowNewModal] = useState(false);
  const [schedulingId, setSchedulingId] = useState(null);

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState(null);
  const [obsDraft, setObsDraft] = useState({});
  const [savingObs, setSavingObs] = useState({});

  const [selected, setSelected] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [slaFilter, setSlaFilter] = useState("ALL");

  const [historySearch, setHistorySearch] = useState("");
  const [historyApproval, setHistoryApproval] = useState("");

  const prevPendingIdsRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getServiceOrders({ includeCompleted: true, serviceType: "INSTALACAO" });
      setAll(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar instalações");
    } finally {
      setLoading(false);
    }
  }

  const currentTab = PORTAL_TABS.find((t) => t.key === tab) ?? PORTAL_TABS[0];
  const inTab = all.filter((so) => tabKeyOf(so) === currentTab.key);

  // Em "Outros", OS ainda abertas (ex.: criadas manualmente) precisam das
  // acoes de agendar/tecnico — vao pra tabela com acoes; so' as concluidas
  // ficam na tabela simples.
  const activeRows = currentTab.kind === "other"
    ? inTab.filter((so) => so.schedulingStatus !== "CONCLUIDO")
    : inTab;
  const simpleRows = inTab.filter((so) => so.schedulingStatus === "CONCLUIDO");
  const showActiveTable = currentTab.kind === "active" || (currentTab.kind === "other" && activeRows.length > 0);
  const showSimpleTable = currentTab.kind === "other" && (simpleRows.length > 0 || activeRows.length === 0);

  function countFor(key) {
    return all.filter((so) => tabKeyOf(so) === key).length;
  }

  function changeTab(key) {
    setTab(key);
    setSelected(new Set());
    setSlaFilter("ALL");
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getServiceOrders({ includeCompleted: true, serviceType: "INSTALACAO" });
        const list = Array.isArray(data) ? data : [];
        const newPending = list.filter((so) => so.portalStatus === "AGUARDANDO_AGENDAMENTO");
        if (prevPendingIdsRef.current !== null) {
          const prevIds = prevPendingIdsRef.current;
          const newItems = newPending.filter((i) => !prevIds.has(i.id));
          if (newItems.length > 0) {
            toast(`${newItems.length} nova(s) instalação(ões)`, { icon: "📋" });
          }
        }
        prevPendingIdsRef.current = new Set(newPending.map((i) => i.id));
        setAll(list);
      } catch (err) {
        console.error(err);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleSaveObservations(so) {
    const text = (obsDraft[so.id] ?? so.observations ?? "").trim();
    setSavingObs((prev) => ({ ...prev, [so.id]: true }));
    try {
      await updateServiceOrder(so.id, {
        requestedBy: so.requestedBy,
        plate: so.plate,
        chassis: so.chassis,
        equipment: so.equipment,
        serviceType: so.serviceType,
        city: so.city,
        address: so.address,
        neighborhood: so.neighborhood,
        state: so.state,
        zipCode: so.zipCode,
        customerName: so.customerName,
        customerPhone: so.customerPhone,
        observations: text,
      });
      setAll((prev) => prev.map((i) => (i.id === so.id ? { ...i, observations: text } : i)));
      toast.success("Observação salva");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar observação");
    } finally {
      setSavingObs((prev) => ({ ...prev, [so.id]: false }));
    }
  }

  async function handleCopy(so) {
    try {
      await navigator.clipboard.writeText(buildMessage(so));
      setCopiedId(so.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Mensagem copiada!");
    } catch {
      toast.error("Erro ao copiar");
    }
  }

  async function handleCopySelected() {
    const msgs = inTab
      .filter((i) => selected.has(i.id))
      .map(buildMessage)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(msgs);
      toast.success(`${selected.size} mensagem(ns) copiada(s)`);
    } catch {
      toast.error("Erro ao copiar");
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const filtered = filteredPending();
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  }

  function filteredPending() {
    if (slaFilter === "ALL") return activeRows;
    return activeRows.filter((i) => slaStatusOf(i) === slaFilter);
  }

  function filteredHistory() {
    return inTab.filter((i) => {
      const matchSearch = !historySearch ||
        (i.customerName?.toLowerCase().includes(historySearch.toLowerCase())) ||
        (i.plate?.toLowerCase().includes(historySearch.toLowerCase())) ||
        (i.city?.toLowerCase().includes(historySearch.toLowerCase()));
      const matchApproval = !historyApproval || i.financialApprovalStatus === historyApproval;
      return matchSearch && matchApproval;
    });
  }

  function handleExportReport() {
    try {
      if (all.length === 0) {
        toast("Nenhum dado encontrado", { icon: "ℹ️" });
        return;
      }
      const headers = ["ID", "Segurado", "Placa", "Endereço", "Bairro", "Cidade", "UF", "CEP", "Telefone", "Status", "Status Portal", "Aprovação Financeira", "SLA Dias", "Solicitado em", "Fechado em"];
      const rows = all.map((i) => [
        i.id, i.customerName, i.plate, i.address, i.neighborhood,
        i.city, i.state, i.zipCode, i.customerPhone,
        i.schedulingStatus, portalStatusLabel(i.portalStatus), i.financialApprovalStatus, i.slaDays ?? "", i.requestedAt ?? "", i.closedAt ?? "",
      ]);
      const csv = [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `instalacoes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar relatório");
    }
  }

  const displayed = filteredPending();
  const allSelected = displayed.length > 0 && selected.size === displayed.length;

  const ok = activeRows.filter((so) => slaStatusOf(so) === "SLA_OK").length;
  const warning = activeRows.filter((so) => slaStatusOf(so) === "SLA_WARNING").length;
  const critical = activeRows.filter((so) => slaStatusOf(so) === "SLA_CRITICAL").length;
  const closedToday = all.filter((so) => so.schedulingStatus === "CONCLUIDO" && isToday(so.closedAt)).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex justify-end gap-2 w-full">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <Plus size={14} />
            Nova Instalação
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            <Download size={14} />
            Relatório completo
          </button>
        </div>
      </div>

      {/* Abas por status do portal */}
      <div className="flex flex-wrap gap-2">
        {PORTAL_TABS.map((t) => {
          const count = countFor(t.key);
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => changeTab(t.key)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                isActive ? "bg-white text-black" : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  t.key === "AGUARDANDO_AGENDAMENTO" ? "bg-red-500 text-white" : isActive ? "bg-zinc-200 text-zinc-700" : "bg-zinc-800 text-zinc-300"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dashboard summary cards — calculados no browser a partir da
          lista ja carregada (GET /service-orders/dashboard agrega
          TODOS os tipos de OS, nao so' instalacao). */}
      {showActiveTable && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="OK (0-1d)"
            value={ok}
            color="text-green-400"
            bg="bg-green-500/10 border-green-500/20"
            onClick={() => setSlaFilter(slaFilter === "SLA_OK" ? "ALL" : "SLA_OK")}
            active={slaFilter === "SLA_OK"}
          />
          <SummaryCard
            label="Atenção (2d)"
            value={warning}
            color="text-yellow-400"
            bg="bg-yellow-500/10 border-yellow-500/20"
            onClick={() => setSlaFilter(slaFilter === "SLA_WARNING" ? "ALL" : "SLA_WARNING")}
            active={slaFilter === "SLA_WARNING"}
          />
          <SummaryCard
            label="Crítico (3+d)"
            value={critical}
            color="text-red-400"
            bg="bg-red-500/10 border-red-500/20"
            onClick={() => setSlaFilter(slaFilter === "SLA_CRITICAL" ? "ALL" : "SLA_CRITICAL")}
            active={slaFilter === "SLA_CRITICAL"}
          />
          <SummaryCard
            label="Fechadas hoje"
            value={closedToday}
            color="text-zinc-300"
            bg="bg-zinc-800/60 border-zinc-700/50"
            onClick={() => changeTab("INSTALACAO_CONCLUIDA_SUCESSO")}
            active={false}
          />
        </div>
      )}

      {/* Bulk action bar */}
      {showActiveTable && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3">
          <span className="text-sm text-zinc-300">{selected.size} selecionada(s)</span>
          <button
            onClick={handleCopySelected}
            className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
          >
            <ClipboardCopy size={13} />
            Copiar mensagens
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Active tab — pending table */}
      {showActiveTable && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          {loading ? (
            <p className="py-10 text-center text-zinc-500">Carregando...</p>
          ) : displayed.length === 0 ? (
            <p className="py-10 text-center text-zinc-500">
              {slaFilter !== "ALL" ? "Nenhuma instalação neste filtro" : `Nenhuma instalação em "${currentTab.label}"`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-zinc-800 bg-zinc-950">
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="w-10 px-4 py-3">
                      <button onClick={toggleSelectAll}>
                        {allSelected ? <CheckSquare size={15} className="text-zinc-300" /> : <Square size={15} />}
                      </button>
                    </th>
                    <th className="px-4 py-3">SLA</th>
                    <th className="px-4 py-3">Segurado</th>
                    <th className="px-4 py-3">Placa</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Cidade/UF</th>
                    <th className="px-4 py-3">Técnico</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((so) => {
                    const { row, badge, dot } = slaColors(slaStatusOf(so));
                    const isExpanded = expandedId === so.id;

                    return (
                      <>
                        <tr
                          key={so.id}
                          className={`border-t border-zinc-800 transition hover:bg-zinc-800/40 cursor-pointer ${row}`}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => toggleSelect(so.id)}>
                              {selected.has(so.id)
                                ? <CheckSquare size={15} className="text-white" />
                                : <Square size={15} className="text-zinc-600" />}
                            </button>
                          </td>
                          <td className="px-4 py-3" onClick={() => toggleExpand(so.id)}>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                              {slaLabel(so)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium" onClick={() => toggleExpand(so.id)}>
                            {so.customerName || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-zinc-300" onClick={() => toggleExpand(so.id)}>
                            {so.plate || "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400" onClick={() => toggleExpand(so.id)}>
                            {so.customerPhone || "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-sm" onClick={() => toggleExpand(so.id)}>
                            {so.city ? `${so.city}/${so.state}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-sm" onClick={() => toggleExpand(so.id)}>
                            {so.technician?.name || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setSchedulingId(so.id)}
                                title="Vincular técnico / agendar"
                                className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                <UserCog size={14} />
                              </button>
                              <button
                                onClick={() => toggleExpand(so.id)}
                                title="Ver / editar observações"
                                className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                <MessageSquarePlus size={14} />
                              </button>
                              <button
                                onClick={() => handleCopy(so)}
                                title="Copiar mensagem"
                                className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                {copiedId === so.id ? <Check size={14} className="text-green-400" /> : <ClipboardCopy size={14} />}
                              </button>
                              <button
                                onClick={() => toggleExpand(so.id)}
                                className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${so.id}-expand`} className="border-t border-zinc-800/50">
                            <td colSpan={8} className="bg-zinc-950 px-6 py-4">
                              <div className="grid gap-4 sm:grid-cols-2">

                                {/* Details */}
                                <div className="space-y-2 text-sm">
                                  <p className="font-semibold text-zinc-300">Detalhes</p>
                                  {so.address && (
                                    <p className="text-zinc-400">
                                      {so.address}
                                      {so.neighborhood ? ` | ${so.neighborhood}` : ""}
                                    </p>
                                  )}
                                  {so.zipCode && <p className="text-zinc-500">CEP: {so.zipCode}</p>}
                                  {so.technician?.name && <p className="text-zinc-400">Técnico: {so.technician.name}</p>}
                                  {so.distanceKm != null && (
                                    <p className="text-zinc-400">Distância: {so.distanceKm} km — Deslocamento: R$ {so.displacementValue ?? 0}</p>
                                  )}
                                  {so.serviceValue != null && <p className="text-zinc-400">Valor do serviço: R$ {so.serviceValue}</p>}
                                  {so.requestedAt && (
                                    <p className="text-zinc-500">Solicitada em: {formatLocalDateTime(so.requestedAt)}</p>
                                  )}
                                  {(so.displacementValue ?? 0) > 0 && (
                                    <p className="text-zinc-500">Aprovação financeira: {so.financialApprovalStatus}</p>
                                  )}
                                </div>

                                {/* Observations — campo unico de texto em
                                    ServiceOrder, nao e' uma lista com
                                    autor/data como era em Installation. */}
                                <div className="space-y-3">
                                  <p className="text-sm font-semibold text-zinc-300">Observações</p>
                                  <textarea
                                    rows={4}
                                    value={obsDraft[so.id] ?? so.observations ?? ""}
                                    onChange={(e) => setObsDraft((prev) => ({ ...prev, [so.id]: e.target.value }))}
                                    placeholder="Observações desta OS..."
                                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-500"
                                  />
                                  <button
                                    onClick={() => handleSaveObservations(so)}
                                    disabled={savingObs[so.id]}
                                    className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
                                  >
                                    {savingObs[so.id] ? "..." : "Salvar"}
                                  </button>
                                </div>

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
          )}
        </div>
      )}

      {/* History tab */}
      {currentTab.kind === "done" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Buscar por cliente, placa, cidade..."
              className="flex-1 min-w-48 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-500"
            />
            <select
              value={historyApproval}
              onChange={(e) => setHistoryApproval(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-300 outline-none"
            >
              <option value="">Todas as aprovações</option>
              <option value="PENDENTE">Pendente</option>
              <option value="APROVADO">Aprovado</option>
              <option value="REPROVADO">Reprovado</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-zinc-800 bg-zinc-950">
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Placa</th>
                    <th className="px-4 py-3">Cidade/UF</th>
                    <th className="px-4 py-3">Técnico</th>
                    <th className="px-4 py-3">Aprovação</th>
                    <th className="px-4 py-3">Duração SLA</th>
                    <th className="px-4 py-3">Fechado em</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="py-10 text-center text-zinc-500">Carregando...</td></tr>
                  ) : filteredHistory().length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-zinc-500">Nenhum registro</td></tr>
                  ) : (
                    filteredHistory().map((so) => (
                      <tr key={so.id} className="border-t border-zinc-800 transition hover:bg-zinc-800/40">
                        <td className="px-4 py-3 font-medium">{so.customerName || "—"}</td>
                        <td className="px-4 py-3 font-mono text-sm text-zinc-300">{so.plate || "—"}</td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{so.city ? `${so.city}/${so.state}` : "—"}</td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{so.technician?.name || "—"}</td>
                        <td className="px-4 py-3"><ApprovalStatusBadge status={so.financialApprovalStatus} /></td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {so.slaDays != null ? `${so.slaDays}d` : "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {so.closedAt ? formatLocalDateTime(so.closedAt) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Outros — OS sem portalStatus conhecido (criada manualmente,
          sem vinculo com o portal, ou com marcador antigo do sync). As
          abertas aparecem na tabela com acoes acima; aqui so' as
          concluidas. */}
      {showSimpleTable && showActiveTable && (
        <p className="text-sm font-semibold text-zinc-400">Concluídas</p>
      )}
      {showSimpleTable && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-zinc-800 bg-zinc-950">
                <tr className="text-left text-xs text-zinc-500">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Cidade/UF</th>
                  <th className="px-4 py-3">Status Fusion</th>
                  <th className="px-4 py-3">Status Portal</th>
                  <th className="px-4 py-3">Solicitado em</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-zinc-500">Carregando...</td></tr>
                ) : simpleRows.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-zinc-500">Nenhum registro</td></tr>
                ) : (
                  simpleRows.map((so) => (
                    <tr key={so.id} className="border-t border-zinc-800 transition hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-medium">{so.customerName || "—"}</td>
                      <td className="px-4 py-3 font-mono text-sm text-zinc-300">{so.plate || "—"}</td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{so.city ? `${so.city}/${so.state}` : "—"}</td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{so.schedulingStatus || "—"}</td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{portalStatusLabel(so.portalStatus)}</td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">
                        {so.requestedAt ? formatLocalDateTime(so.requestedAt) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewModal && (
        <InstallationModal
          onClose={() => setShowNewModal(false)}
          onSaved={load}
        />
      )}

      {schedulingId && (
        <SchedulingModal
          serviceOrderId={schedulingId}
          onClose={() => setSchedulingId(null)}
          onSaved={load}
        />
      )}

    </div>
  );
}

function SummaryCard({ label, value, color, bg, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:opacity-90 ${bg} ${active ? "ring-2 ring-white/20" : ""}`}
    >
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </button>
  );
}

function ApprovalStatusBadge({ status }) {
  const map = {
    APROVADO:  { label: "Aprovado",  cls: "bg-green-500/15 text-green-400" },
    REPROVADO: { label: "Reprovado", cls: "bg-red-500/15 text-red-400" },
    PENDENTE:  { label: "Pendente",  cls: "bg-yellow-500/15 text-yellow-400" },
  };
  const { label, cls } = map[status] || { label: status || "—", cls: "bg-zinc-700/40 text-zinc-400" };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
  );
}
