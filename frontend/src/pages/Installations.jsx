import { useEffect, useRef, useState } from "react";

import toast from "react-hot-toast";

import {
  AlertTriangle,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Download,
  MessageSquarePlus,
  RefreshCw,
  Square,
  X,
} from "lucide-react";

import {
  addInstallationObservation,
  cancelInstallation,
  dismissInstallationAlert,
  getInstallationObservations,
  getInstallations,
  getInstallationsDashboard,
  getInstallationReport,
  markInstallationSent,
} from "../services/installationService";

import { formatLocalDateTime } from "../utils/dateUtils";

function buildMessage(inst) {
  return (
    `*INSTALAÇÃO NOVA*\n\n` +
    `*NOME:* ${inst.customerName?.toUpperCase()}\n` +
    `*ENDEREÇO:* ${inst.address?.toUpperCase()} | *BAIRRO:* ${inst.neighborhood?.toUpperCase()} - ${inst.city?.toUpperCase()}/${inst.state?.toUpperCase()}\n` +
    `*CEP:* ${inst.zipCode}\n` +
    `*TELEFONE:* ${inst.phone}\n` +
    `*PLACA:* ${inst.plate?.toUpperCase()}\n` +
    `*MODELO:* ${inst.model?.toUpperCase()}`
  );
}

function slaColors(slaStatus, dismissed) {
  if (dismissed) return { row: "opacity-50", badge: "bg-zinc-700/40 text-zinc-400", dot: "bg-zinc-500" };
  if (slaStatus === "SLA_CRITICAL") return { row: "bg-red-500/5 border-l-2 border-red-500/40", badge: "bg-red-500/15 text-red-400", dot: "bg-red-500" };
  if (slaStatus === "SLA_WARNING")  return { row: "bg-yellow-500/5 border-l-2 border-yellow-500/40", badge: "bg-yellow-500/15 text-yellow-400", dot: "bg-yellow-500" };
  return { row: "", badge: "bg-green-500/15 text-green-400", dot: "bg-green-500" };
}

function slaLabel(inst) {
  if (inst.slaDays == null) return "—";
  if (inst.slaDays === 0) return "Hoje";
  if (inst.slaDays === 1) return "1 dia";
  return `${inst.slaDays} dias`;
}

export default function Installations() {
  const [tab, setTab] = useState("active");

  const [dashboard, setDashboard] = useState(null);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState(null);
  const [observations, setObservations] = useState({});
  const [loadingObs, setLoadingObs] = useState({});
  const [addingObs, setAddingObs] = useState({});
  const [obsText, setObsText] = useState({});

  const [selected, setSelected] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [slaFilter, setSlaFilter] = useState("ALL");

  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");

  const prevPendingIdsRef = useRef(null);

  async function loadDashboard() {
    try {
      const data = await getInstallationsDashboard();
      setDashboard(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadPending() {
    const data = await getInstallations("PENDING");
    return Array.isArray(data) ? data : [];
  }

  async function loadHistory() {
    const [scheduled, sent, cancelled] = await Promise.all([
      getInstallations("SCHEDULED"),
      getInstallations("SENT"),
      getInstallations("CANCELLED"),
    ]);
    return [
      ...(Array.isArray(scheduled) ? scheduled : []),
      ...(Array.isArray(sent) ? sent : []),
      ...(Array.isArray(cancelled) ? cancelled : []),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function load() {
    setLoading(true);
    try {
      const [p, h] = await Promise.all([loadPending(), loadHistory()]);
      setPending(p);
      setHistory(h);
      await loadDashboard();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar instalações");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const p = await loadPending();
        if (prevPendingIdsRef.current !== null) {
          const prevIds = prevPendingIdsRef.current;
          const newItems = p.filter((i) => !prevIds.has(i.id));
          if (newItems.length > 0) {
            toast(`${newItems.length} nova(s) instalação(ões)`, { icon: "📋" });
          }
        }
        prevPendingIdsRef.current = new Set(p.map((i) => i.id));
        setPending(p);
        loadDashboard();
      } catch (err) {
        console.error(err);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!observations[id]) {
      setLoadingObs((prev) => ({ ...prev, [id]: true }));
      try {
        const data = await getInstallationObservations(id);
        setObservations((prev) => ({ ...prev, [id]: Array.isArray(data) ? data : [] }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingObs((prev) => ({ ...prev, [id]: false }));
      }
    }
  }

  async function handleAddObservation(id) {
    const text = (obsText[id] || "").trim();
    if (!text) return;
    setAddingObs((prev) => ({ ...prev, [id]: true }));
    try {
      const obs = await addInstallationObservation(id, text);
      setObservations((prev) => ({ ...prev, [id]: [obs, ...(prev[id] || [])] }));
      setObsText((prev) => ({ ...prev, [id]: "" }));
      setPending((prev) =>
        prev.map((i) => i.id === id ? { ...i, lastObservation: text } : i)
      );
      toast.success("Observação salva");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar observação");
    } finally {
      setAddingObs((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleDismiss(id) {
    try {
      const updated = await dismissInstallationAlert(id);
      setPending((prev) => prev.map((i) => i.id === id ? { ...i, alertDismissedAt: updated.alertDismissedAt } : i));
      toast.success("Alerta dispensado para hoje");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao dispensar alerta");
    }
  }

  async function handleCopy(inst) {
    try {
      await navigator.clipboard.writeText(buildMessage(inst));
      setCopiedId(inst.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Mensagem copiada!");
    } catch {
      toast.error("Erro ao copiar");
    }
  }

  async function handleCopySelected() {
    const msgs = pending
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
    if (slaFilter === "ALL") return pending;
    return pending.filter((i) => i.slaStatus === slaFilter);
  }

  function filteredHistory() {
    return history.filter((i) => {
      const matchSearch = !historySearch ||
        (i.customerName?.toLowerCase().includes(historySearch.toLowerCase())) ||
        (i.plate?.toLowerCase().includes(historySearch.toLowerCase())) ||
        (i.city?.toLowerCase().includes(historySearch.toLowerCase()));
      const matchStatus = !historyStatus || i.status === historyStatus;
      return matchSearch && matchStatus;
    });
  }

  function isDismissedToday(inst) {
    if (!inst.alertDismissedAt) return false;
    const today = new Date().toISOString().slice(0, 10);
    return String(inst.alertDismissedAt).slice(0, 10) === today;
  }

  async function handleExportReport() {
    try {
      toast("Gerando relatório...", { icon: "📊" });
      const data = await getInstallationReport({});
      if (!Array.isArray(data) || data.length === 0) {
        toast("Nenhum dado encontrado", { icon: "ℹ️" });
        return;
      }
      const headers = ["ID", "Segurado", "Placa", "Modelo", "Endereço", "Bairro", "Cidade", "UF", "CEP", "Telefone", "Proposta", "Serviço", "Status", "SLA Dias", "Criado em", "Fechado em"];
      const rows = data.map((i) => [
        i.id, i.customerName, i.plate, i.model, i.address, i.neighborhood,
        i.city, i.state, i.zipCode, i.phone, i.numeroProposta,
        i.serviceType, i.status, i.slaDays ?? "", i.portalCreatedAt ?? "", i.closedAt ?? "",
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

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("active")}
            className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              tab === "active" ? "bg-white text-black" : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Aguardando
            {pending.length > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              tab === "history" ? "bg-white text-black" : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Histórico
          </button>
        </div>

        <div className="flex gap-2">
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

      {/* Dashboard summary cards */}
      {tab === "active" && dashboard && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="OK (0-1d)"
            value={dashboard.stats?.ok ?? 0}
            color="text-green-400"
            bg="bg-green-500/10 border-green-500/20"
            onClick={() => setSlaFilter(slaFilter === "SLA_OK" ? "ALL" : "SLA_OK")}
            active={slaFilter === "SLA_OK"}
          />
          <SummaryCard
            label="Atenção (2d)"
            value={dashboard.stats?.warning ?? 0}
            color="text-yellow-400"
            bg="bg-yellow-500/10 border-yellow-500/20"
            onClick={() => setSlaFilter(slaFilter === "SLA_WARNING" ? "ALL" : "SLA_WARNING")}
            active={slaFilter === "SLA_WARNING"}
          />
          <SummaryCard
            label="Crítico (3+d)"
            value={dashboard.stats?.critical ?? 0}
            color="text-red-400"
            bg="bg-red-500/10 border-red-500/20"
            onClick={() => setSlaFilter(slaFilter === "SLA_CRITICAL" ? "ALL" : "SLA_CRITICAL")}
            active={slaFilter === "SLA_CRITICAL"}
          />
          <SummaryCard
            label="Fechadas hoje"
            value={dashboard.stats?.closedToday ?? 0}
            color="text-zinc-300"
            bg="bg-zinc-800/60 border-zinc-700/50"
            onClick={() => { setTab("history"); }}
            active={false}
          />
        </div>
      )}

      {/* Bulk action bar */}
      {tab === "active" && selected.size > 0 && (
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
      {tab === "active" && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          {loading ? (
            <p className="py-10 text-center text-zinc-500">Carregando...</p>
          ) : displayed.length === 0 ? (
            <p className="py-10 text-center text-zinc-500">
              {slaFilter !== "ALL" ? "Nenhuma instalação neste filtro" : "Nenhuma instalação aguardando agendamento"}
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
                    <th className="px-4 py-3">Última obs.</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((inst) => {
                    const dismissed = isDismissedToday(inst);
                    const { row, badge, dot } = slaColors(inst.slaStatus, dismissed);
                    const isExpanded = expandedId === inst.id;

                    return (
                      <>
                        <tr
                          key={inst.id}
                          className={`border-t border-zinc-800 transition hover:bg-zinc-800/40 cursor-pointer ${row}`}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => toggleSelect(inst.id)}>
                              {selected.has(inst.id)
                                ? <CheckSquare size={15} className="text-white" />
                                : <Square size={15} className="text-zinc-600" />}
                            </button>
                          </td>
                          <td className="px-4 py-3" onClick={() => toggleExpand(inst.id)}>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                              {slaLabel(inst)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium" onClick={() => toggleExpand(inst.id)}>
                            {inst.customerName || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-zinc-300" onClick={() => toggleExpand(inst.id)}>
                            {inst.plate || "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400" onClick={() => toggleExpand(inst.id)}>
                            {inst.phone || "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-sm" onClick={() => toggleExpand(inst.id)}>
                            {inst.city ? `${inst.city}/${inst.state}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-xs max-w-xs truncate" onClick={() => toggleExpand(inst.id)}>
                            {inst.lastObservation || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => { toggleExpand(inst.id); }}
                                title="Ver / adicionar observação"
                                className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                <MessageSquarePlus size={14} />
                              </button>
                              <button
                                onClick={() => handleCopy(inst)}
                                title="Copiar mensagem"
                                className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                {copiedId === inst.id ? <Check size={14} className="text-green-400" /> : <ClipboardCopy size={14} />}
                              </button>
                              {inst.slaStatus === "SLA_CRITICAL" && !dismissed && (
                                <button
                                  onClick={() => handleDismiss(inst.id)}
                                  title="Dispensar alerta hoje"
                                  className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-yellow-400"
                                >
                                  <Clock size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => toggleExpand(inst.id)}
                                className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${inst.id}-expand`} className="border-t border-zinc-800/50">
                            <td colSpan={8} className="bg-zinc-950 px-6 py-4">
                              <div className="grid gap-4 sm:grid-cols-2">

                                {/* Details */}
                                <div className="space-y-2 text-sm">
                                  <p className="font-semibold text-zinc-300">Detalhes</p>
                                  {inst.address && (
                                    <p className="text-zinc-400">
                                      {inst.address}
                                      {inst.neighborhood ? ` | ${inst.neighborhood}` : ""}
                                    </p>
                                  )}
                                  {inst.zipCode && <p className="text-zinc-500">CEP: {inst.zipCode}</p>}
                                  {inst.model && <p className="text-zinc-400">Modelo: {inst.model}</p>}
                                  {inst.numeroProposta && (
                                    <p className="text-zinc-400">Proposta: <span className="font-mono">{inst.numeroProposta}</span></p>
                                  )}
                                  {inst.serviceType && <p className="text-zinc-400">Tipo: {inst.serviceType}</p>}
                                  {inst.portalCreatedAt && (
                                    <p className="text-zinc-500">Criada no portal: {formatLocalDateTime(inst.portalCreatedAt)}</p>
                                  )}
                                </div>

                                {/* Observations */}
                                <div className="space-y-3">
                                  <p className="text-sm font-semibold text-zinc-300">Observações</p>

                                  {/* Add observation */}
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={obsText[inst.id] || ""}
                                      onChange={(e) => setObsText((prev) => ({ ...prev, [inst.id]: e.target.value }))}
                                      onKeyDown={(e) => e.key === "Enter" && handleAddObservation(inst.id)}
                                      placeholder="Nova observação..."
                                      className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-500"
                                    />
                                    <button
                                      onClick={() => handleAddObservation(inst.id)}
                                      disabled={addingObs[inst.id] || !(obsText[inst.id] || "").trim()}
                                      className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
                                    >
                                      {addingObs[inst.id] ? "..." : "Salvar"}
                                    </button>
                                  </div>

                                  {/* Obs list */}
                                  {loadingObs[inst.id] ? (
                                    <p className="text-xs text-zinc-600">Carregando...</p>
                                  ) : (observations[inst.id] || []).length === 0 ? (
                                    <p className="text-xs text-zinc-600">Sem observações</p>
                                  ) : (
                                    <div className="max-h-40 overflow-y-auto space-y-2">
                                      {(observations[inst.id] || []).map((obs) => (
                                        <div key={obs.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2">
                                          <p className="text-sm text-zinc-200">{obs.text}</p>
                                          <p className="mt-1 text-xs text-zinc-600">
                                            {obs.createdBy} · {formatLocalDateTime(obs.createdAt)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
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
      {tab === "history" && (
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
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-300 outline-none"
            >
              <option value="">Todos os status</option>
              <option value="SCHEDULED">Agendado</option>
              <option value="SENT">Enviado</option>
              <option value="CANCELLED">Cancelado</option>
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
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
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
                    filteredHistory().map((inst) => (
                      <tr key={inst.id} className="border-t border-zinc-800 transition hover:bg-zinc-800/40">
                        <td className="px-4 py-3 font-medium">{inst.customerName || "—"}</td>
                        <td className="px-4 py-3 font-mono text-sm text-zinc-300">{inst.plate || "—"}</td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{inst.city ? `${inst.city}/${inst.state}` : "—"}</td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{inst.serviceType || "—"}</td>
                        <td className="px-4 py-3"><HistoryStatusBadge status={inst.status} /></td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {inst.slaDays != null ? `${inst.slaDays}d` : "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {inst.closedAt ? formatLocalDateTime(inst.closedAt) : "—"}
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

function HistoryStatusBadge({ status }) {
  const map = {
    SENT:      { label: "Enviado",   cls: "bg-green-500/15 text-green-400" },
    SCHEDULED: { label: "Agendado",  cls: "bg-blue-500/15 text-blue-400" },
    CANCELLED: { label: "Cancelado", cls: "bg-zinc-700/40 text-zinc-400" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-zinc-700/40 text-zinc-400" };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
  );
}
