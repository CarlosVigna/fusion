import { useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import { CheckCircle2, Mail, MessageCircle, RefreshCw, X } from "lucide-react";

import {
  generateLineCancelEmail,
  getLineCancels,
  markLineCancelDone,
  requestLineCancel,
  syncLineCancels,
  verifyLineCancel,
} from "../services/lineCancelService";

import Pagination from "../components/ui/Pagination";

import { usePagination } from "../hooks/usePagination";

import { formatLocalDate as formatDate } from "../utils/dateUtils";

const TABS = [
  { key: "AGUARDANDO", label: "🟡 Aguardando" },
  { key: "VERIFICAR", label: "🟠 Verificar" },
  { key: "PRONTO", label: "🔴 Pronto" },
  { key: "SOLICITADO", label: "📧 Solicitado" },
  { key: "CONCLUIDO", label: "✅ Concluído" },
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function LineCancels() {

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("AGUARDANDO");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionId, setActionId] = useState(null);
  const [emailModal, setEmailModal] = useState(null);

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

  const activeItems = byStatus[activeTab] || [];

  const {
    page,
    setPage,
    totalPages,
    pageItems,
    pageSize,
    totalItems,
  } = usePagination(activeItems);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
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

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === activeItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeItems.map((r) => r.id)));
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
                      checked={activeItems.length > 0 && selectedIds.size === activeItems.length}
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
                <th className="px-4 py-4">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showCheckbox ? 10 : 9} className="px-6 py-10 text-center text-zinc-500">
                    Carregando...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={showCheckbox ? 10 : 9} className="px-6 py-10 text-center text-zinc-500">
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
                    <td className="px-4 py-4 text-zinc-400">{record.policyStatus || "--"}</td>
                    <td className="px-4 py-4 text-zinc-400">{formatDate(record.policyEndDate)}</td>
                    <td className="px-4 py-4 text-zinc-400">{daysSince(record.policyEndDate) ?? "--"}</td>
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
