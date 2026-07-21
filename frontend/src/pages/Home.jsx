import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getDashboard } from "../services/dashboardService";

import { getInstallationsPendingCount } from "../services/installationService";

import { getEtlStatus } from "../services/etlStatusService";

import { getActiveSignalReturnAlerts } from "../services/signalReturnAlertService";

import { getOverdueMaintenanceRecords } from "../services/maintenanceService";

import { getPolicyAlerts } from "../services/policyService";

import { formatLocalDateTime } from "../utils/dateUtils";

import { formatDelay } from "../utils/formatDelay";

function formatDuration(ms) {
  if (ms == null) return "--";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
}

// Formata LocalDate ("YYYY-MM-DD") sem conversão de fuso
function formatDateBR(d) {
  if (!d) return "--";
  const parts = d.split("T")[0].split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function Home() {

  const [dashboard, setDashboard] = useState(null);

  const [installationsPending, setInstallationsPending] = useState(null);

  const [etlStatus, setEtlStatus] = useState([]);

  const [signalAlerts, setSignalAlerts] = useState([]);

  const [overdueMaintenances, setOverdueMaintenances] = useState([]);

  const [policyAlerts, setPolicyAlerts] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {

    async function load() {

      try {

        const [dash, instCount, etl, alerts, maintenances, polAlerts] = await Promise.all([
          getDashboard(),
          getInstallationsPendingCount(),
          getEtlStatus(),
          getActiveSignalReturnAlerts(),
          getOverdueMaintenanceRecords(),
          getPolicyAlerts(),
        ]);

        setDashboard(dash);
        setInstallationsPending(instCount?.count ?? 0);
        setEtlStatus(Array.isArray(etl) ? etl : []);
        setSignalAlerts(alerts || []);
        setOverdueMaintenances(maintenances || []);
        setPolicyAlerts(Array.isArray(polAlerts) ? polAlerts : []);

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);

      }

    }

    load();

  }, []);

  const ultimaPosicao = etlStatus.find(
    (e) => e.type === "MULTIPORTAL_ULTIMA_POSICAO"
  );

  return (
    <div className="space-y-6">

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">

        <StatCard
          label="Veículos monitorados"
          value={dashboard?.monitoredVehicles}
          loading={loading}
        />

        <StatCard
          label="Sinais atrasados >24h"
          value={dashboard?.delayedSignalCount}
          loading={loading}
          color="red"
        />

        <StatCard
          label="Cartas pendentes"
          value={dashboard?.pendingLettersCount}
          loading={loading}
          color="yellow"
        />

        <StatCard
          label="Manutenções vencidas"
          value={dashboard?.overdueMaintenanceCount}
          loading={loading}
          color="orange"
        />

        <StatCard
          label="Instalações pendentes"
          value={installationsPending}
          loading={loading}
          color="blue"
        />

      </div>

      {/* Painel ETL */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Última sincronização ETL — Posição dos veículos
        </p>

        {loading ? (

          <div className="flex gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-28 animate-pulse rounded bg-zinc-800" />
            ))}
          </div>

        ) : ultimaPosicao ? (

          <div className="flex flex-wrap gap-8">
            <EtlField label="Quando rodou" value={formatLocalDateTime(ultimaPosicao.lastRunAt)} />
            <EtlField label="Registros" value={ultimaPosicao.lastRecordsProcessed ?? "--"} />
            <EtlField label="Duração" value={formatDuration(ultimaPosicao.lastDurationMs)} />
            <EtlField label="Próxima execução" value={formatLocalDateTime(ultimaPosicao.nextRunAt)} />
            <EtlField label="Status" value={<EtlStatusLabel status={ultimaPosicao.status} />} />
          </div>

        ) : (

          <p className="text-sm text-zinc-500">Nenhuma execução registrada.</p>

        )}

      </div>

      {/* Alertas recentes */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Retorno de sinal */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <p className="text-sm font-semibold">Alertas de retorno de sinal</p>
            <Link
              to="/signal-control"
              className="text-xs text-zinc-400 transition hover:text-white"
            >
              Ver Controle de Sinais →
            </Link>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : signalAlerts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              Nenhum alerta pendente
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {signalAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-semibold">{alert.vehiclePlate}</p>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {formatDelay(alert.previousDelayMinutes)} de ausência
                    </span>
                  </div>
                  {alert.insuredName && (
                    <p className="mt-0.5 text-xs text-zinc-400">{alert.insuredName}</p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Manutenções vencidas */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <p className="text-sm font-semibold">Manutenções com prazo vencido</p>
            <Link
              to="/maintenance"
              className="text-xs text-zinc-400 transition hover:text-white"
            >
              Ver Manutenções →
            </Link>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : overdueMaintenances.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              Nenhuma manutenção vencida
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {overdueMaintenances.slice(0, 3).map((m) => (
                <div key={m.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-semibold">{m.plate || "--"}</p>
                    <span className="shrink-0 text-xs text-red-400">
                      Prazo: {formatDateBR(m.prazoEncerramento)}
                    </span>
                  </div>
                  {m.insuredName && (
                    <p className="mt-0.5 text-xs text-zinc-400">{m.insuredName}</p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Apólices em alerta */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <p className="text-sm font-semibold">Apólices — vencidas / a vencer</p>
            <Link
              to="/policies"
              className="text-xs text-zinc-400 transition hover:text-white"
            >
              Ver Apólices →
            </Link>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : policyAlerts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              Nenhuma apólice em alerta
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {policyAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-semibold">{alert.plate}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        alert.alertType === "EXPIRED"
                          ? "bg-red-500/15 text-red-400"
                          : alert.alertType === "EXPIRING_TODAY"
                            ? "bg-orange-500/15 text-orange-400"
                            : "bg-yellow-500/15 text-yellow-400"
                      }`}
                    >
                      {alert.alertType === "EXPIRED"
                        ? "Vencida"
                        : alert.alertType === "EXPIRING_TODAY"
                          ? "Vence hoje"
                          : alert.alertType === "EXPIRING_THIS_WEEK"
                            ? "Esta semana"
                            : `${alert.daysRemaining}d`}
                    </span>
                  </div>
                  {alert.insuredName && (
                    <p className="mt-0.5 text-xs text-zinc-400">{alert.insuredName}</p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

    </div>
  );

}

function StatCard({ label, value, loading, color = "white" }) {

  const c = {
    white:  { text: "text-white",        border: "border-zinc-800" },
    red:    { text: "text-red-400",       border: "border-red-500/20" },
    yellow: { text: "text-yellow-400",    border: "border-yellow-500/20" },
    orange: { text: "text-orange-400",    border: "border-orange-500/20" },
    blue:   { text: "text-blue-400",      border: "border-blue-500/20" },
  }[color];

  return (
    <div className={`rounded-2xl border ${c.border} bg-zinc-900 p-5`}>
      <p className="mb-2 text-xs text-zinc-500">{label}</p>
      {loading ? (
        <div className="h-9 w-14 animate-pulse rounded bg-zinc-800" />
      ) : (
        <p className={`text-4xl font-bold ${c.text}`}>{value ?? "--"}</p>
      )}
    </div>
  );

}

function EtlField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function EtlStatusLabel({ status }) {
  if (status === "SUCCESS") return <span className="text-green-400">✓ OK</span>;
  if (status === "ERROR")   return <span className="text-red-400">✗ Erro</span>;
  if (status === "RUNNING") return <span className="text-blue-400">⟳ Executando</span>;
  return <span className="text-zinc-400">{status ?? "--"}</span>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-800" />
      ))}
    </div>
  );
}
