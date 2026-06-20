import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { getImportHistory } from "../services/auditService";

import {
  approveChange,
  getPendingChanges,
  rejectChange,
} from "../services/pendingChangeService";

import { getOperationalGrid } from "../services/gridService";

const IMPORT_TYPE_LABELS = {
  MULTIPORTAL_DEVICE: "Dispositivos",
  MULTIPORTAL_LINKAGE: "Vínculo",
  MULTIPORTAL_OPERATIONAL: "Última Posição",
  TRACKNME: "TracknMe",
};

function formatDateTime(value) {

  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("pt-BR");

}

export default function Monitoring() {

  const [history, setHistory] =
    useState([]);

  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [pendingChanges, setPendingChanges] =
    useState([]);

  const [pendingLoading, setPendingLoading] =
    useState(true);

  const [resolvingId, setResolvingId] =
    useState(null);

  const [summary, setSummary] =
    useState({
      total: 0,
      updated: 0,
      stale: 0,
    });

  async function loadHistory() {

    try {

      const data = await getImportHistory();

      setHistory(data);

    } catch (error) {

      console.error(error);

    } finally {

      setHistoryLoading(false);

    }

  }

  async function loadPendingChanges() {

    try {

      const data = await getPendingChanges();

      setPendingChanges(data);

    } catch (error) {

      console.error(error);

    } finally {

      setPendingLoading(false);

    }

  }

  async function loadSummary() {

    try {

      const vehicles = await getOperationalGrid();

      const now = Date.now();

      let updated = 0;
      let stale = 0;

      vehicles.forEach((vehicle) => {

        if (!vehicle.positionDate) {
          return;
        }

        const positionAt = new Date(
          `${vehicle.positionDate}T${vehicle.positionTime || "00:00:00"}`
        ).getTime();

        const minutesAgo = (now - positionAt) / 60000;

        if (minutesAgo < 35) {
          updated++;
        } else if (minutesAgo > 120) {
          stale++;
        }

      });

      setSummary({
        total: vehicles.length,
        updated,
        stale,
      });

    } catch (error) {

      console.error(error);

    }

  }

  useEffect(() => {

    loadHistory();
    loadPendingChanges();
    loadSummary();

  }, []);

  async function handleResolve(id, action) {

    setResolvingId(id);

    try {

      if (action === "approve") {
        await approveChange(id);
        toast.success("Mudança aprovada");
      } else {
        await rejectChange(id);
        toast.success("Mudança rejeitada");
      }

      setPendingChanges((current) =>
        current.filter((change) => change.id !== id)
      );

    } catch (error) {

      console.error(error);

      toast.error("Erro ao resolver mudança");

    } finally {

      setResolvingId(null);

    }

  }

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-bold">
          Monitoramento
        </h1>

        <p className="mt-1 text-zinc-400">
          Histórico de importações, mudanças pendentes e integridade dos dados
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-500">VEÍCULOS ATIVOS</p>
          <h2 className="mt-3 text-4xl font-bold">{summary.total}</h2>
        </div>

        <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-6">
          <p className="text-sm text-zinc-400">ATUALIZADOS (&lt;35min)</p>
          <h2 className="mt-3 text-4xl font-bold">{summary.updated}</h2>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <p className="text-sm text-zinc-400">DESATUALIZADOS (&gt;2h)</p>
          <h2 className="mt-3 text-4xl font-bold">{summary.stale}</h2>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <p className="text-sm text-zinc-400">MUDANÇAS PENDENTES</p>
          <h2 className="mt-3 text-4xl font-bold">{pendingChanges.length}</h2>
        </div>

      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

        <div className="border-b border-zinc-800 p-6">
          <h2 className="text-xl font-semibold">Últimas importações</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-zinc-950">
              <tr className="text-left text-sm text-zinc-400">
                <th className="px-4 py-4">Tipo</th>
                <th className="px-4 py-4">Data/Hora</th>
                <th className="px-4 py-4">Registros</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Origem</th>
              </tr>
            </thead>

            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                    Carregando...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                    Nenhuma importação registrada
                  </td>
                </tr>
              ) : (
                history.map((item, index) => (
                  <tr
                    key={index}
                    className="border-t border-zinc-800 transition hover:bg-zinc-800"
                  >
                    <td className="px-4 py-4">
                      {IMPORT_TYPE_LABELS[item.type] || item.type}
                    </td>

                    <td className="px-4 py-4">
                      {formatDateTime(item.createdAt)}
                    </td>

                    <td className="px-4 py-4">
                      {item.processedRecords ?? "--"}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`
                          rounded-full px-3 py-1 text-xs font-semibold
                          ${item.status === "SUCCESS"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"}
                        `}
                      >
                        {item.status === "SUCCESS" ? "SUCESSO" : "ERRO"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-zinc-400">
                      {item.importedBy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

        <div className="border-b border-zinc-800 p-6">
          <h2 className="text-xl font-semibold">Mudanças pendentes de aprovação</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Alterações detectadas em campos sensíveis durante os imports — não aplicadas até aprovação.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-zinc-950">
              <tr className="text-left text-sm text-zinc-400">
                <th className="px-4 py-4">Placa</th>
                <th className="px-4 py-4">Campo</th>
                <th className="px-4 py-4">Valor antigo → novo</th>
                <th className="px-4 py-4">Origem</th>
                <th className="px-4 py-4">Detectado em</th>
                <th className="px-4 py-4">Ações</th>
              </tr>
            </thead>

            <tbody>
              {pendingLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                    Carregando...
                  </td>
                </tr>
              ) : pendingChanges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                    Nenhuma mudança pendente
                  </td>
                </tr>
              ) : (
                pendingChanges.map((change) => (
                  <tr
                    key={change.id}
                    className="border-t border-zinc-800 transition hover:bg-zinc-800"
                  >
                    <td className="px-4 py-4 font-mono font-semibold">
                      {change.vehiclePlate}
                    </td>

                    <td className="px-4 py-4">{change.fieldName}</td>

                    <td className="px-4 py-4 text-sm">
                      <span className="text-zinc-500">{change.oldValue}</span>
                      {" → "}
                      <span className="text-white">{change.newValue}</span>
                    </td>

                    <td className="px-4 py-4 text-zinc-400">
                      {change.sourceImport}
                    </td>

                    <td className="px-4 py-4 text-zinc-400">
                      {formatDateTime(change.detectedAt)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolve(change.id, "approve")}
                          disabled={resolvingId === change.id}
                          className="
                            rounded-xl bg-green-500/15 px-3 py-1.5
                            text-xs font-semibold text-green-400
                            transition hover:bg-green-500/25
                            disabled:opacity-50
                          "
                        >
                          Aprovar
                        </button>

                        <button
                          onClick={() => handleResolve(change.id, "reject")}
                          disabled={resolvingId === change.id}
                          className="
                            rounded-xl bg-red-500/15 px-3 py-1.5
                            text-xs font-semibold text-red-400
                            transition hover:bg-red-500/25
                            disabled:opacity-50
                          "
                        >
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
