import { useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import { CheckCircle2, FileSpreadsheet, FileText, Mail, MessageCircle, RefreshCw, X } from "lucide-react";

import {
  exportLineCancels,
  generateLineCancelEmail,
  getLineCancels,
  markLineCancelDone,
  requestLineCancel,
  setLineCancelDate,
  syncLineCancels,
  verifyLineCancel,
} from "../services/lineCancelService";

import Pagination from "../components/ui/Pagination";

import { usePagination } from "../hooks/usePagination";

import { formatLocalDate as formatDate } from "../utils/dateUtils";

const STATUS_LABELS = {
  AGUARDANDO: "Aguardando",
  VERIFICAR: "Verificar",
  PRONTO: "Pronto",
  SOLICITADO: "Solicitado",
  CONCLUIDO: "Concluído",
};

const TAB_EMOJI = {
  AGUARDANDO: "🟡",
  VERIFICAR: "🟠",
  PRONTO: "🔴",
  SOLICITADO: "📧",
  CONCLUIDO: "✅",
};

const TABS = Object.keys(STATUS_LABELS).map((key) => ({
  key,
  label: `${TAB_EMOJI[key]} ${STATUS_LABELS[key]}`,
}));

// Traducao do PolicyStatus (backend) — so' pra exibicao. Comparacoes
// contra record.policyStatus continuam usando o valor cru em ingles.
const POLICY_STATUS_LABELS = {
  ACTIVE: "Vigente",
  EXPIRING: "Vencendo",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
  CLOSED: "Encerrada",
  FUTURE: "Futura",
  SUPERSEDED: "Substituída",
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Mesma regra do backend (LineCancelService.referenceDate()): CANCELLED
// depende do usuario informar a data manualmente; CLOSED/EXPIRED usam a
// data de fim de vigencia da apolice, que ja vem preenchida do sync.
function referenceDate(record) {
  return record.policyStatus === "CANCELLED" ? record.cancelledAt : record.policyEndDate;
}

export default function LineCancels() {

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("AGUARDANDO");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionId, setActionId] = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [plateFilter, setPlateFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getLineCancels();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar cancelamentos de linha");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const byStatus = useMemo(() => {
    const grouped = Object.fromEntries(TABS.map((t) => [t.key, []]));
    records.forEach((r) => {
      if (grouped[r.status]) grouped[r.status].push(r);
    });
    return grouped;
  }, [records]);

  const activeItems = useMemo(() => byStatus[activeTab] || [], [byStatus, activeTab]);

  // Aba Aguardando nao tem filtro nenhum — mostra sempre tudo, pedido
  // explicito. Nas demais, plate/periodo filtram em cima da mesma
  // data ja carregada (sem round-trip extra so pra filtrar a tela).
  const hasFilters = activeTab !== "AGUARDANDO";

  const filteredItems = useMemo(() => {

    if (!hasFilters) return activeItems;

    const plateNeedle = plateFilter.trim().toUpperCase();

    return activeItems.filter((r) => {

      if (plateNeedle && !(r.plate || "").toUpperCase().includes(plateNeedle)) {
        return false;
      }

      const ref = referenceDate(r);

      if (dateFrom && (!ref || ref < dateFrom)) return false;
      if (dateTo && (!ref || ref > dateTo)) return false;

      return true;

    });

  }, [activeItems, hasFilters, plateFilter, dateFrom, dateTo]);

  const {
    page,
    setPage,
    totalPages,
    pageItems,
    pageSize,
    totalItems,
  } = usePagination(filteredItems);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setPlateFilter("");
    setDateFrom("");
    setDateTo("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleSync() {
    setSyncing(true);
    try {
      const { created } = await syncLineCancels();
      toast.success(created > 0 ? `${created} novo(s) registro(s) encontrado(s)` : "Nenhum registro novo");
      load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao sincronizar com as apólices");
    } finally {
      setSyncing(false);
    }
  }

  async function handleVerify(id) {
    setActionId(id);
    try {
      await verifyLineCancel(id);
      toast.success("Verificação confirmada");
      load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao confirmar verificação");
    } finally {
      setActionId(null);
    }
  }

  async function handleDone(id) {
    setActionId(id);
    try {
      await markLineCancelDone(id);
      toast.success("Marcado como concluído");
      load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao marcar como concluído");
    } finally {
      setActionId(null);
    }
  }

  async function handleSetDate(id, value) {
    if (!value) return;
    setActionId(id);
    try {
      await setLineCancelDate(id, value);
      toast.success("Data de cancelamento salva");
      load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar data de cancelamento");
    } finally {
      setActionId(null);
    }
  }

  async function handleExport(format) {
    setExporting(format);
    try {
      await exportLineCancels({
        format,
        status: activeTab,
        plate: plateFilter.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar");
    } finally {
      setExporting(null);
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((r) => r.id)));
    }
  }

  async function handleGenerateEmail() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      const { text } = await generateLineCancelEmail(ids);
      setEmailModal({ text, ids });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar e-mail");
    }
  }

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(emailModal.text);
      toast.success("Texto copiado!");
    } catch {
      toast.error("Erro ao copiar");
    }
  }

  function handleOpenWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(emailModal.text)}`, "_blank");
  }

  async function handleConfirmRequested() {
    try {
      await Promise.all(emailModal.ids.map((id) => requestLineCancel(id)));
      toast.success("Marcado(s) como solicitado(s)");
      setEmailModal(null);
      setSelectedIds(new Set());
      load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao marcar como solicitado");
    }
  }

  const showCheckbox = activeTab === "PRONTO";

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Cancelamento de Linhas</h1>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="
            flex items-center gap-2 rounded-2xl border border-zinc-700
            bg-zinc-950 px-5 py-2.5 text-sm font-semibold
            transition hover:bg-zinc-800 disabled:opacity-50
          "
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando..." : "Sincronizar com apólices"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition
              ${activeTab === tab.key
                ? "bg-white text-black"
                : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"}
            `}
          >
            {tab.label}
            {byStatus[tab.key]?.length > 0 && (
              <span
                className={`
                  rounded-full px-2 py-0.5 text-xs font-bold
                  ${activeTab === tab.key ? "bg-black/10 text-black" : "bg-red-500 text-white"}
                `}
              >
                {byStatus[tab.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Placa</label>
            <input
              value={plateFilter}
              onChange={(e) => setPlateFilter(e.target.value)}
              placeholder="Ex: ABC1D23"
              className="
                rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2
                text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-500
              "
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="
                rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2
                text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-500
              "
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="
                rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2
                text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-500
              "
            />
          </div>

          <div className="ml-auto flex gap-2">
            <button
              onClick={() => handleExport("EXCEL")}
              disabled={!!exporting}
              className="
                flex items-center gap-2 rounded-xl border border-zinc-700
                bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-300
                transition hover:bg-zinc-800 disabled:opacity-50
              "
            >
              <FileSpreadsheet size={14} />
              {exporting === "EXCEL" ? "Gerando..." : "Excel"}
            </button>
            <button
              onClick={() => handleExport("PDF")}
              disabled={!!exporting}
              className="
                flex items-center gap-2 rounded-xl border border-zinc-700
                bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-300
                transition hover:bg-zinc-800 disabled:opacity-50
              "
            >
              <FileText size={14} />
              {exporting === "PDF" ? "Gerando..." : "PDF"}
            </button>
          </div>

        </div>
      )}

      {showCheckbox && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3">
          <span className="text-sm text-zinc-300">{selectedIds.size} selecionada(s)</span>
          <button
            onClick={handleGenerateEmail}
            className="
              flex items-center gap-2 rounded-xl bg-white px-4 py-2
              text-xs font-semibold text-black transition hover:opacity-90
            "
          >
            <Mail size={13} />
            Gerar E-mail
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="max-h-[36rem] overflow-auto">
          <table className="min-w-full">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr className="text-left text-sm text-zinc-400">
                {showCheckbox && (
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-700"
                    />
                  </th>
                )}
                <th className="px-4 py-4">Placa</th>
                <th className="px-4 py-4">Segurado</th>
                <th className="px-4 py-4">ICCID</th>
                <th className="px-4 py-4">MSISDN</th>
                <th className="px-4 py-4">IMEI</th>
                <th className="px-4 py-4">Status Apólice</th>
                <th className="px-4 py-4">Data Cancelamento</th>
                <th className="px-4 py-4">Dias</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showCheckbox ? 11 : 10} className="px-6 py-10 text-center text-zinc-500">
                    Carregando...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={showCheckbox ? 11 : 10} className="px-6 py-10 text-center text-zinc-500">
                    Nenhum registro nesta aba
                  </td>
                </tr>
              ) : (
                pageItems.map((record) => (
                  <tr key={record.id} className="border-t border-zinc-800">
                    {showCheckbox && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.id)}
                          onChange={() => toggleSelect(record.id)}
                          className="rounded border-zinc-700"
                        />
                      </td>
                    )}
                    <td className="px-4 py-4 font-mono font-semibold">{record.plate}</td>
                    <td className="px-4 py-4">{record.insuredName || "--"}</td>
                    <td className="px-4 py-4 font-mono text-xs text-zinc-400">{record.iccid || "--"}</td>
                    <td className="px-4 py-4 font-mono text-xs text-zinc-400">{record.msisdn || "--"}</td>
                    <td className="px-4 py-4 font-mono text-xs text-zinc-400">{record.imei || "--"}</td>
                    <td className="px-4 py-4 text-zinc-400">
                      {POLICY_STATUS_LABELS[record.policyStatus] || record.policyStatus || "--"}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {record.policyStatus === "CANCELLED" && !record.cancelledAt ? (
                        <input
                          type="date"
                          disabled={actionId === record.id}
                          onChange={(e) => handleSetDate(record.id, e.target.value)}
                          className="
                            rounded-lg border border-zinc-700 bg-zinc-950
                            px-2 py-1 text-xs text-white
                            focus:outline-none focus:ring-1 focus:ring-zinc-500
                            disabled:opacity-50
                          "
                        />
                      ) : record.policyStatus === "CANCELLED" ? (
                        formatDate(record.cancelledAt)
                      ) : (
                        formatDate(record.policyEndDate)
                      )}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {referenceDate(record) ? daysSince(referenceDate(record)) : "--"}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {STATUS_LABELS[record.status] || record.status}
                    </td>
                    <td className="px-4 py-4">
                      {record.status === "VERIFICAR" && (
                        <button
                          onClick={() => handleVerify(record.id)}
                          disabled={actionId === record.id}
                          className="
                            flex items-center gap-1.5 rounded-xl border border-zinc-700
                            bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-300
                            transition hover:bg-green-500/15 hover:text-green-400
                            disabled:opacity-50
                          "
                        >
                          <CheckCircle2 size={13} />
                          Confirmar verificação
                        </button>
                      )}
                      {record.status === "SOLICITADO" && (
                        <button
                          onClick={() => handleDone(record.id)}
                          disabled={actionId === record.id}
                          className="
                            flex items-center gap-1.5 rounded-xl border border-zinc-700
                            bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-300
                            transition hover:bg-green-500/15 hover:text-green-400
                            disabled:opacity-50
                          "
                        >
                          <CheckCircle2 size={13} />
                          Marcar como Concluído
                        </button>
                      )}
                      {(record.status === "AGUARDANDO" || record.status === "PRONTO" || record.status === "CONCLUIDO") && (
                        <span className="text-xs text-zinc-600">--</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6">

            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">E-mail de cancelamento</h3>
              <button
                onClick={() => setEmailModal(null)}
                className="text-zinc-500 transition hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              readOnly
              value={emailModal.text}
              rows={14}
              className="
                mb-5 w-full resize-none rounded-xl border border-zinc-700
                bg-zinc-950 p-3 text-sm text-zinc-200
                focus:outline-none
              "
            />

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopyEmail}
                className="
                  flex items-center gap-2 rounded-xl border border-zinc-700
                  bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-300
                  transition hover:bg-zinc-800
                "
              >
                📋 Copiar
              </button>

              <button
                onClick={handleOpenWhatsapp}
                className="
                  flex items-center gap-2 rounded-xl border border-zinc-700
                  bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-300
                  transition hover:bg-green-500/15 hover:text-green-400
                "
              >
                <MessageCircle size={15} />
                Abrir no WhatsApp
              </button>

              <button
                onClick={handleConfirmRequested}
                className="
                  ml-auto flex items-center gap-2 rounded-xl bg-white
                  px-4 py-2.5 text-sm font-semibold text-black
                  transition hover:opacity-90
                "
              >
                <CheckCircle2 size={15} />
                Marcar como Solicitado
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
