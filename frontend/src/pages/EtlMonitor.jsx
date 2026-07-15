import { useEffect, useState } from "react";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { getEtlStatus } from "../services/etlStatusService";

import { getImportHistory } from "../services/auditService";

import { apiClient } from "../services/api/apiClient";

import { formatLocalDateTime } from "../utils/dateUtils";

import { realtimeService } from "../services/realtime/realtimeService";

const TYPE_LABELS = {
  MULTIPORTAL_ULTIMA_POSICAO: "Última Posição",
  MULTIPORTAL_DEVICE: "Dispositivos",
  MULTIPORTAL_LINKAGE: "Vínculo",
  MULTIPORTAL_OPERATIONAL: "Lista Operacional",
  TRACKNME: "TracknMe",
  INSTALACOES: "Instalações",
};

const POLL_INTERVAL_MS = 15000;

function formatDuration(ms) {

  if (ms == null) {
    return "--";
  }

  const seconds = Math.round(ms / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;

}

function StatusBadge({ status }) {

  if (status === "RUNNING") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-400">
        <Loader2 size={12} className="animate-spin" />
        Em execução
      </span>
    );
  }

  if (status === "ERROR") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400">
        <AlertCircle size={12} />
        Erro
      </span>
    );
  }

  if (status === "SUCCESS") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">
        <CheckCircle2 size={12} />
        OK
      </span>
    );
  }

  return (
    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-400">
      Sem dados
    </span>
  );

}

export default function EtlMonitor() {

  const [statuses, setStatuses] =
    useState([]);

  const [history, setHistory] =
    useState([]);

  const [installationSync, setInstallationSync] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  async function load() {

    try {

      const [statusData, historyData, syncData] = await Promise.all([
        getEtlStatus(),
        getImportHistory(),
        apiClient.get("/installations/last-sync").catch(() => null),
      ]);

      setStatuses(statusData);

      setHistory(historyData.slice(0, 15));

      if (syncData) setInstallationSync(syncData);

    } catch (error) {

      console.error(error);

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

    const interval = setInterval(load, POLL_INTERVAL_MS);

    const unsubscribe = realtimeService.onDashboardEvent((event) => {

      if (event?.type === "GRID_UPDATED") {

        load();

      }

    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };

  }, []);

  const knownTypes = Object.keys(TYPE_LABELS).filter(
    (type) => type !== "TRACKNME" && type !== "MULTIPORTAL_OPERATIONAL"
  );

  if (loading) {
    return (
      <div className="p-6 text-zinc-400">
        Carregando monitor do ETL...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="grid gap-4 md:grid-cols-3">

        {knownTypes.map((type) => {

          const status = statuses.find((s) => s.type === type);
          const isInstalacoes = type === "INSTALACOES";

          return (
            <div
              key={type}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >

              <div className="flex items-center justify-between">

                <p className="text-sm font-semibold text-zinc-300">
                  {TYPE_LABELS[type]}
                </p>

                <StatusBadge status={status?.status} />

              </div>

              <dl className="mt-4 space-y-2 text-sm">

                <div className="flex justify-between">
                  <dt className="text-zinc-500">Última execução</dt>
                  <dd>{formatLocalDateTime(status?.lastRunAt)}</dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-zinc-500">Duração</dt>
                  <dd>{formatDuration(status?.lastDurationMs)}</dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-zinc-500">Próxima execução</dt>
                  <dd>{formatLocalDateTime(status?.nextRunAt)}</dd>
                </div>

                {isInstalacoes ? (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Encontradas</dt>
                      <dd>{installationSync?.found ?? "--"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Inseridas</dt>
                      <dd>{installationSync?.inserted ?? "--"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Ignoradas</dt>
                      <dd>{installationSync?.skipped ?? "--"}</dd>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Registros</dt>
                    <dd>{status?.lastRecordsProcessed ?? "--"}</dd>
                  </div>
                )}

              </dl>

              {status?.lastError && (
                <p className="mt-3 truncate rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {status.lastError}
                </p>
              )}

            </div>
          );

        })}

      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

        <div className="border-b border-zinc-800 p-6">
          <h2 className="text-xl font-semibold">
            Histórico recente de importações
          </h2>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          <table className="min-w-full">
            <thead className="sticky top-0 bg-zinc-950">
              <tr className="text-left text-sm text-zinc-400">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Data/Hora</th>
                <th className="px-4 py-3">Registros</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Origem</th>
              </tr>
            </thead>

            <tbody>

              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                    Nenhuma importação registrada
                  </td>
                </tr>
              ) : (
                history.map((item, index) => (
                  <tr
                    key={index}
                    className="border-t border-zinc-800 transition hover:bg-zinc-800/60"
                  >
                    <td className="px-4 py-3">
                      {TYPE_LABELS[item.type] || item.type}
                    </td>

                    <td className="px-4 py-3 text-zinc-400">
                      {formatLocalDateTime(item.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      {item.processedRecords ?? "--"}
                    </td>

                    <td className="px-4 py-3">
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

                    <td className="px-4 py-3 text-zinc-400">
                      {item.importedBy}
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
