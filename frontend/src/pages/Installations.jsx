import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { Check, ClipboardCopy, Plus, Trash2, X } from "lucide-react";

import {
  cancelInstallation,
  deleteInstallation,
  getInstallations,
  markInstallationSent,
} from "../services/installationService";

import { formatLocalDateTime } from "../utils/dateUtils";

import InstallationModal from "../components/installations/InstallationModal";

function buildMessage(inst) {
  return [
    `${inst.serviceType || "INSTALAÇÃO NOVA"}:`,
    `NOME: ${inst.customerName || ""}`,
    `ENDEREÇO: ${inst.address || ""} | BAIRRO: ${inst.neighborhood || ""} - ${inst.city || ""}.`,
    `CEP: ${inst.zipCode || ""}`,
    `TELEFONE: ${inst.phone || ""}`,
    `PLACA: ${inst.plate || ""}`,
    inst.model ? `MODELO: ${inst.model}` : null,
  ].filter(Boolean).join("\n");
}

export default function Installations() {

  const [tab, setTab] = useState("pending");

  const [pending, setPending] = useState([]);

  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);

  const [copiedId, setCopiedId] = useState(null);

  const [sendingId, setSendingId] = useState(null);

  const [cancellingId, setCancellingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null);

  async function load() {

    setLoading(true);

    try {

      const [p, sent, cancelled] = await Promise.all([
        getInstallations("PENDING"),
        getInstallations("SENT"),
        getInstallations("CANCELLED"),
      ]);

      setPending(p);

      setHistory(
        [...sent, ...cancelled].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      );

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar instalações");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {
    load();
  }, []);

  async function handleCopy(inst) {

    try {

      await navigator.clipboard.writeText(buildMessage(inst));

      setCopiedId(inst.id);

      toast.success("Mensagem copiada!");

      setTimeout(() => setCopiedId(null), 2000);

    } catch (error) {

      toast.error("Erro ao copiar");

    }

  }

  async function handleSent(id) {

    setSendingId(id);

    try {

      const updated = await markInstallationSent(id);

      setPending((prev) => prev.filter((i) => i.id !== id));

      setHistory((prev) => [updated, ...prev]);

      toast.success("Marcado como enviado");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao marcar como enviado");

    } finally {

      setSendingId(null);

    }

  }

  async function executeCancel(id) {

    setCancellingId(id);

    try {

      await cancelInstallation(id);

      setPending((prev) => prev.filter((i) => i.id !== id));

      toast.success("Instalação cancelada");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao cancelar instalação");

    } finally {

      setCancellingId(null);

    }

  }

  function handleCancel(id) {

    setConfirmAction({
      message: "Cancelar esta instalação?",
      onConfirm: () => executeCancel(id),
    });

  }

  async function executeDelete(id) {

    try {

      await deleteInstallation(id);

      setHistory((prev) => prev.filter((i) => i.id !== id));

      toast.success("Instalação removida");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao remover instalação");

    }

  }

  function handleDelete(id) {

    setConfirmAction({
      message: "Remover esta instalação? Esta ação não pode ser desfeita.",
      onConfirm: () => executeDelete(id),
    });

  }

  return (
    <div className="space-y-6">

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <p className="mb-5 text-sm text-zinc-300">{confirmAction.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">

        <div className="flex gap-2">
          <button
            onClick={() => setTab("pending")}
            className={`
              flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition
              ${tab === "pending"
                ? "bg-white text-black"
                : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"}
            `}
          >
            Pendentes
            {pending.length > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`
              rounded-2xl px-5 py-2.5 text-sm font-semibold transition
              ${tab === "history"
                ? "bg-white text-black"
                : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"}
            `}
          >
            Histórico
          </button>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        >
          <Plus size={16} />
          Nova Instalação
        </button>

      </div>

      {/* Pendentes */}
      {tab === "pending" && (
        <>
          {loading ? (
            <p className="py-10 text-center text-zinc-500">Carregando...</p>
          ) : pending.length === 0 ? (
            <p className="py-10 text-center text-zinc-500">
              Nenhuma instalação pendente
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((inst) => (
                <PendingCard
                  key={inst.id}
                  inst={inst}
                  copied={copiedId === inst.id}
                  sending={sendingId === inst.id}
                  cancelling={cancellingId === inst.id}
                  onCopy={() => handleCopy(inst)}
                  onSent={() => handleSent(inst.id)}
                  onCancel={() => handleCancel(inst.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Histórico */}
      {tab === "history" && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="max-h-[36rem] overflow-auto">
            <table className="min-w-full">
              <thead className="sticky top-0 z-10 bg-zinc-950">
                <tr className="text-left text-sm text-zinc-400">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Enviado em</th>
                  <th className="px-4 py-3">Enviado por</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-zinc-500">
                      Carregando...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-zinc-500">
                      Nenhum registro no histórico
                    </td>
                  </tr>
                ) : (
                  history.map((inst) => (
                    <tr
                      key={inst.id}
                      className="border-t border-zinc-800 transition hover:bg-zinc-800/40"
                    >
                      <td className="px-4 py-3 font-medium">{inst.customerName || "--"}</td>
                      <td className="px-4 py-3 font-mono">{inst.plate || "--"}</td>
                      <td className="px-4 py-3 text-zinc-400">{inst.city || "--"}</td>
                      <td className="px-4 py-3 text-zinc-400">{inst.serviceType || "--"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {formatLocalDateTime(inst.sentAt)}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{inst.sentBy || "--"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(inst.id)}
                          title="Remover"
                          className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-400 transition hover:bg-red-500/15 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <InstallationModal
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}

    </div>
  );

}

function PendingCard({ inst, copied, sending, cancelling, onCopy, onSent, onCancel }) {

  return (
    <div
      className="
        flex flex-col gap-4 rounded-2xl
        border border-zinc-800 bg-zinc-900 p-5
        transition
      "
    >

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold leading-tight">{inst.customerName || "—"}</p>
          {inst.plate && (
            <p className="mt-0.5 font-mono text-sm text-zinc-400">{inst.plate}</p>
          )}
          {inst.model && (
            <p className="mt-0.5 text-xs text-zinc-500">{inst.model}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-semibold text-yellow-400">
          {inst.serviceType || "PENDENTE"}
        </span>
      </div>

      <div className="space-y-1 text-sm text-zinc-400">
        {inst.address && (
          <p>
            {inst.address}
            {inst.neighborhood ? ` | ${inst.neighborhood}` : ""}
            {inst.city ? ` - ${inst.city}` : ""}
          </p>
        )}
        {inst.zipCode && <p>CEP: {inst.zipCode}</p>}
        {inst.phone && <p>Tel: {inst.phone}</p>}
      </div>

      <div className="flex gap-2">

        <button
          onClick={onCopy}
          className="
            flex flex-1 items-center justify-center gap-2
            rounded-xl border border-zinc-700 bg-zinc-950
            py-2 text-xs font-semibold text-zinc-300
            transition hover:bg-zinc-800
          "
        >
          {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
          {copied ? "Copiado!" : "Copiar mensagem"}
        </button>

        <button
          onClick={onSent}
          disabled={sending}
          className="
            flex flex-1 items-center justify-center gap-2
            rounded-xl bg-green-500/20
            py-2 text-xs font-semibold text-green-400
            transition hover:bg-green-500/30
            disabled:opacity-50
          "
        >
          {sending ? "..." : <><Check size={13} /> Marcar enviado</>}
        </button>

        <button
          onClick={onCancel}
          disabled={cancelling}
          title="Cancelar"
          className="
            rounded-xl border border-zinc-700 bg-zinc-950
            p-2 text-zinc-400 transition
            hover:bg-red-500/15 hover:text-red-400
            disabled:opacity-50
          "
        >
          <X size={14} />
        </button>

      </div>

    </div>
  );

}

function StatusBadge({ status }) {

  if (status === "SENT") {
    return (
      <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">
        ✅ Enviado
      </span>
    );
  }

  if (status === "CANCELLED") {
    return (
      <span className="rounded-full bg-zinc-700/40 px-3 py-1 text-xs font-semibold text-zinc-400">
        Cancelado
      </span>
    );
  }

  return (
    <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-semibold text-yellow-400">
      Pendente
    </span>
  );

}
