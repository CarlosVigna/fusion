import { useEffect, useRef, useState } from "react";

import { Link, useLocation } from "react-router-dom";

import toast from "react-hot-toast";

import { Bell, LogOut, Search } from "lucide-react";

import { useAuthStore } from "../../store/authStore";

import {
  dismissSignalReturnAlert,
  getActiveSignalReturnAlerts,
} from "../../services/signalReturnAlertService";

import {
  dismissImportDiff,
  getRecentImportDiffs,
} from "../../services/importStatusService";

import { dismissAllPolicyAlerts, dismissPolicyAlert, getPolicyAlerts } from "../../services/policyService";

import {
  confirmInstallation,
  getPendingConfirmations,
  ignorePendingConfirmation,
} from "../../services/stockService";

import { formatDelay } from "../../utils/formatDelay";

const POLL_INTERVAL_MS = 60000;

// Fonte única do título exibido no topo — cada página não renderiza
// mais seu próprio <h1>, evitando títulos duplicados/divergentes.
const PAGE_TITLES = [
  { match: /^\/$/, title: "Início", subtitle: "Visão geral da operação" },
  { match: /^\/grid$/, title: "Grid Operacional", subtitle: "Consolidação operacional realtime" },
  { match: /^\/dashboard$/, title: "Central Operacional", subtitle: "Tudo que precisa da sua atenção neste turno" },
  { match: /^\/imports$/, title: "Import Center", subtitle: "Central operacional de importações" },
  { match: /^\/vehicles\/.+$/, title: "Detalhes do Veículo", subtitle: "" },
  { match: /^\/vehicles$/, title: "Veículos", subtitle: "Cadastro operacional consolidado" },
  { match: /^\/signal-control$/, title: "Controle de Sinais", subtitle: "Veículos sem comunicação há mais de 24h — fluxo de atendimento" },
  { match: /^\/letters$/, title: "Cartas de Suspensão", subtitle: "Controle de cartas de suspensão por cobertura" },
  { match: /^\/maintenance$/, title: "Manutenção", subtitle: "Veículos em manutenção de equipamento" },
  { match: /^\/installations\/reports$/, title: "Relatórios de Instalações", subtitle: "Histórico filtrado com exportação Excel e PDF" },
  { match: /^\/installations$/, title: "Instalações", subtitle: "Fila de instalações pendentes de envio" },
  { match: /^\/policies$/, title: "Apólices", subtitle: "Gestão de apólices de seguro dos veículos" },
  { match: /^\/etl$/, title: "Monitor do ETL", subtitle: "Status, histórico e execuções dos scrapers" },
  { match: /^\/reports$/, title: "Relatórios", subtitle: "Geração e atualização de planilhas operacionais" },
  { match: /^\/account$/, title: "Minha Conta", subtitle: "Dados pessoais, senha e tema" },
];

function getPageTitle(pathname) {

  const found = PAGE_TITLES.find((entry) => entry.match.test(pathname));

  return found || { title: "Fusion", subtitle: "" };

}

function formatDateTime(value) {

  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("pt-BR");

}

export default function Header() {
  const location = useLocation();

  const { title, subtitle } = getPageTitle(location.pathname);

  const user = useAuthStore(
    (state) => state.user
  );

  const logout = useAuthStore(
    (state) => state.logout
  );

  const isFieldOrTech = user?.role === "FIELD" || user?.role === "TECHNICIAN";

  const [alerts, setAlerts] =
    useState([]);

  const [policyAlerts, setPolicyAlerts] =
    useState([]);

  const [alertsOpen, setAlertsOpen] =
    useState(false);

  const [dismissingId, setDismissingId] =
    useState(null);

  const [dismissingAll, setDismissingAll] =
    useState(false);

  const [dismissingPolicyId, setDismissingPolicyId] =
    useState(null);

  const [dismissingAllPolicy, setDismissingAllPolicy] =
    useState(false);

  const [importDiffs, setImportDiffs] =
    useState([]);

  const [dismissingDiffId, setDismissingDiffId] =
    useState(null);

  const [diffModalData, setDiffModalData] =
    useState(null);

  const [stockPending, setStockPending] =
    useState([]);

  const [stockActionId, setStockActionId] =
    useState(null);

  const alertsRef = useRef(null);

  // Ao contrario dos outros alertas (admin/operator), confirmacao de
  // estoque e' justamente pro tecnico de campo — sem o early-return de
  // isFieldOrTech que loadAlerts() usa pros demais.
  async function loadStockPending() {
    try {
      const data = await getPendingConfirmations();
      setStockPending(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadStockPending();
    const interval = setInterval(loadStockPending, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function handleConfirmStock(item) {
    setStockActionId(item.stockId);
    try {
      await confirmInstallation(item.stockId, {
        plate: item.plate,
        installedAt: new Date().toISOString().slice(0, 10),
      });
      setStockPending((current) => current.filter((i) => i.id !== item.id));
      toast.success("Instalação confirmada");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao confirmar instalação");
    } finally {
      setStockActionId(null);
    }
  }

  async function handleIgnoreStock(item) {
    setStockActionId(item.stockId);
    try {
      await ignorePendingConfirmation(item.id);
      setStockPending((current) => current.filter((i) => i.id !== item.id));
    } catch (error) {
      console.error(error);
      toast.error("Erro ao ignorar confirmação");
    } finally {
      setStockActionId(null);
    }
  }

  async function loadAlerts() {
    if (isFieldOrTech) return;
    try {
      const [signalResult, polResult, diffsResult] = await Promise.allSettled([
        getActiveSignalReturnAlerts(),
        getPolicyAlerts(),
        getRecentImportDiffs(),
      ]);
      setAlerts(signalResult.status === "fulfilled" ? (signalResult.value || []) : []);
      // Sino só mostra apólices que entraram em alerta hoje pela
      // primeira vez (isNewToday) — a página /policies/alerts continua
      // mostrando todas, novas ou não.
      const allPolicyAlerts = polResult.status === "fulfilled" && Array.isArray(polResult.value) ? polResult.value : [];
      setPolicyAlerts(allPolicyAlerts.filter((pa) => pa.isNewToday));
      setImportDiffs(diffsResult.status === "fulfilled" && Array.isArray(diffsResult.value) ? diffsResult.value : []);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isFieldOrTech]);

  useEffect(() => {

    function handleClickOutside(e) {

      if (
        alertsRef.current &&
        !alertsRef.current.contains(e.target)
      ) {

        setAlertsOpen(false);

      }

    }

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );

  }, []);

  async function handleDismiss(id) {

    setDismissingId(id);

    try {

      await dismissSignalReturnAlert(id);

      setAlerts((current) =>
        current.filter((alert) => alert.id !== id)
      );

      toast.success("Alerta dispensado");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dispensar alerta");

    } finally {

      setDismissingId(null);

    }

  }

  async function handleDismissPolicy(id) {

    setDismissingPolicyId(id);

    try {

      await dismissPolicyAlert(id);

      setPolicyAlerts((current) =>
        current.filter((pa) => pa.id !== id)
      );

      toast.success("Alerta de apólice dispensado");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dispensar alerta");

    } finally {

      setDismissingPolicyId(null);

    }

  }

  async function handleDismissDiff(id) {

    setDismissingDiffId(id);

    try {

      await dismissImportDiff(id);

      setImportDiffs((current) =>
        current.filter((d) => d.id !== id)
      );

    } catch (error) {

      console.error(error);

    } finally {

      setDismissingDiffId(null);

    }

  }

  async function handleDismissAllPolicy() {

    setDismissingAllPolicy(true);

    try {

      await dismissAllPolicyAlerts();

      setPolicyAlerts([]);

      toast.success("Alertas de apólice dispensados");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dispensar alertas de apólice");

    } finally {

      setDismissingAllPolicy(false);

    }

  }

  async function handleDismissAll() {

    const idsToDismiss = alerts.map((alert) => alert.id);

    setDismissingAll(true);

    try {

      await Promise.all(
        idsToDismiss.map((id) => dismissSignalReturnAlert(id))
      );

      setAlerts((current) =>
        current.filter((alert) => !idsToDismiss.includes(alert.id))
      );

      toast.success("Todas as notificações foram dispensadas");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dispensar notificações");

    } finally {

      setDismissingAll(false);

    }

  }

  return (
    <header
      className="
        flex items-center justify-between
        border-b border-zinc-800
        bg-zinc-900 px-6 py-4
      "
    >
      <div>
        <h2 className="text-xl font-semibold text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="text-sm text-zinc-400">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div
          className="
            flex items-center gap-2
            rounded-xl border border-zinc-800
            bg-zinc-950 px-3 py-2
          "
        >
          <Search
            size={18}
            className="text-zinc-500"
          />

          <input
            type="text"
            placeholder="Buscar..."
            className="
              bg-transparent text-sm
              outline-none
              placeholder:text-zinc-500
            "
          />
        </div>

        <div ref={alertsRef} className="relative">

          <button
            onClick={() => setAlertsOpen((open) => !open)}
            className="
              relative rounded-xl border border-zinc-800
              bg-zinc-950 p-3
              transition hover:bg-zinc-800
            "
          >
            <Bell size={18} />

            {(alerts.length + policyAlerts.length + importDiffs.length + stockPending.length) > 0 && (
              <span
                className="
                  absolute -right-1 -top-1
                  flex h-5 w-5 items-center justify-center
                  rounded-full bg-red-500
                  text-xs font-bold text-white
                "
              >
                {alerts.length + policyAlerts.length + importDiffs.length + stockPending.length}
              </span>
            )}
          </button>

          {alertsOpen && (

            <div
              className="
                absolute right-0 top-full z-30
                mt-2 w-96 max-h-[28rem] overflow-y-auto
                rounded-2xl border border-zinc-800
                bg-zinc-950 p-3 shadow-xl
              "
            >

              {stockPending.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 px-2 text-xs font-semibold text-zinc-500">ESTOQUE DE EQUIPAMENTOS</p>
                  <div className="space-y-1">
                    {stockPending.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
                      >
                        <p className="text-xs text-zinc-300">
                          📦 Equipamento do técnico {item.technicianName || "—"} detectado em{" "}
                          <span className="font-mono font-semibold text-white">{item.plate}</span>
                          {" — confirmar instalação?"}
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            onClick={() => handleIgnoreStock(item)}
                            disabled={stockActionId === item.stockId}
                            className="rounded-lg bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
                          >
                            Ignorar
                          </button>
                          <button
                            onClick={() => handleConfirmStock(item)}
                            disabled={stockActionId === item.stockId}
                            className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="my-2 border-t border-zinc-800" />
                </div>
              )}

              {policyAlerts.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between px-2 mb-1">
                    <p className="text-xs font-semibold text-zinc-500">APÓLICES</p>
                    <button
                      onClick={handleDismissAllPolicy}
                      disabled={dismissingAllPolicy}
                      className="text-xs font-semibold text-zinc-400 transition hover:text-white disabled:opacity-50"
                    >
                      Dispensar todas
                    </button>
                  </div>
                  <div className="space-y-1">
                    {policyAlerts.slice(0, 5).map((pa) => (
                      <div
                        key={pa.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold">{pa.plate}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                pa.alertType === "EXPIRED"
                                  ? "text-red-400"
                                  : pa.alertType === "EXPIRING_TODAY"
                                    ? "text-orange-400"
                                    : "text-yellow-400"
                              }`}
                            >
                              {pa.alertType === "EXPIRED"
                                ? "Vencida"
                                : pa.alertType === "EXPIRING_TODAY"
                                  ? "Hoje"
                                  : pa.alertType === "EXPIRING_THIS_WEEK"
                                    ? "Esta semana"
                                    : `${pa.daysRemaining}d`}
                            </span>
                            <button
                              onClick={() => handleDismissPolicy(pa.id)}
                              disabled={dismissingPolicyId === pa.id}
                              title="Dispensar"
                              className="
                                text-zinc-500 hover:text-white
                                disabled:opacity-40 transition
                                leading-none
                              "
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {pa.insuredName && (
                          <p className="text-xs text-zinc-400">{pa.insuredName}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="my-2 border-t border-zinc-800" />
                </div>
              )}

              <div className="flex items-center justify-between px-2 py-1">

                <p className="text-xs font-semibold text-zinc-500">
                  RETORNO DE SINAL
                </p>

                {alerts.length > 0 && (
                  <button
                    onClick={handleDismissAll}
                    disabled={dismissingAll}
                    className="
                      text-xs font-semibold text-zinc-400
                      transition hover:text-white
                      disabled:opacity-50
                    "
                  >
                    Dispensar todas
                  </button>
                )}

              </div>

              {importDiffs.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 px-2 text-xs font-semibold text-zinc-500">IMPORTAÇÕES</p>
                  <div className="space-y-1">
                    {importDiffs.map((diff) => (
                      <div
                        key={diff.id}
                        className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm transition hover:border-zinc-700"
                        onClick={() => { setAlertsOpen(false); setDiffModalData(diff); }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-300">
                            {diff.importType === "MULTIPORTAL_DEVICE" ? "Dispositivos" : "Vínculos"}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDismissDiff(diff.id); }}
                            disabled={dismissingDiffId === diff.id}
                            title="Dispensar"
                            className="text-zinc-500 hover:text-white disabled:opacity-40 transition leading-none"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {[
                            diff.added   > 0 && `${diff.added} entraram`,
                            diff.removed > 0 && `${diff.removed} saíram`,
                            diff.changed > 0 && `${diff.changed} alterados`,
                          ].filter(Boolean).join(", ") || "Sem alterações"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="my-2 border-t border-zinc-800" />
                </div>
              )}

              {alerts.length === 0 && policyAlerts.length === 0 && importDiffs.length === 0 && stockPending.length === 0 ? (

                <p className="px-2 py-4 text-center text-sm text-zinc-500">
                  Nenhum alerta ativo
                </p>

              ) : alerts.length === 0 ? null : (

                <div className="space-y-2">

                  {alerts.map((alert) => (

                    <div
                      key={alert.id}
                      className="
                        rounded-xl border border-zinc-800
                        bg-zinc-900 p-3 text-sm
                      "
                    >

                      <p className="font-semibold">
                        🟢 {alert.vehiclePlate}
                        {alert.insuredName && ` — ${alert.insuredName}`}
                      </p>

                      <p className="mt-1 text-zinc-400">
                        Sinal retornou após{" "}
                        {formatDelay(alert.previousDelayMinutes)}{" "}
                        de ausência
                      </p>

                      {alert.lastObservationText && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Última obs: {alert.lastObservationText}
                          {" — por "}
                          {alert.lastObservationBy}
                          {" em "}
                          {formatDateTime(alert.lastObservationAt)}
                        </p>
                      )}

                      <button
                        onClick={() => handleDismiss(alert.id)}
                        disabled={dismissingId === alert.id}
                        className="
                          mt-2 rounded-lg bg-zinc-800 px-3 py-1.5
                          text-xs font-semibold
                          transition hover:bg-zinc-700
                          disabled:opacity-50
                        "
                      >
                        Dispensar
                      </button>

                    </div>

                  ))}

                </div>

              )}

            </div>

          )}

        </div>

        <Link
          to="/account"
          className="
            flex items-center gap-3
            rounded-xl border border-zinc-800
            bg-zinc-950 px-4 py-2
            transition hover:bg-zinc-800
          "
        >
          <div
            className="
              flex h-9 w-9 shrink-0 items-center
              justify-center overflow-hidden rounded-full
              bg-zinc-800 font-bold
            "
          >
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt="Foto de perfil"
                className="h-full w-full object-cover"
              />
            ) : (
              user?.name?.[0] || "U"
            )}
          </div>

          <div>
            <p className="text-sm font-medium">
              {user?.name || "Usuário"}
            </p>

            <p className="text-xs text-zinc-500">
              {user?.role || "Operador"}
            </p>
          </div>
        </Link>

        <button
          onClick={logout}
          title="Sair"
          className="
            flex items-center gap-2
            rounded-xl border border-zinc-800
            bg-zinc-950 p-3
            text-zinc-400
            transition hover:bg-zinc-800 hover:text-white
          "
        >
          <LogOut size={18} />
        </button>
      </div>

      {diffModalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDiffModalData(null)}
        >
          <div
            className="w-[520px] max-h-[80vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {diffModalData.importType === "MULTIPORTAL_LINKAGE"
                ? "Atualização de Vínculos"
                : "Atualização de Dispositivos"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {new Date(diffModalData.createdAt).toLocaleString("pt-BR")}
            </p>

            {(() => {
              const details = diffModalData.detailsJson || {};
              const added   = details.added   || [];
              const removed = details.removed || [];
              const changed = details.changed || [];
              return (
                <>
                  {added.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-green-400">✅ Entraram ({added.length})</p>
                      <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                        {added.map((item, i) => (
                          <li key={i} className="text-xs text-zinc-300">
                            <span className="font-mono">{item.plate}</span>
                            {item.name ? ` — ${item.name}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {removed.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-red-400">❌ Saíram ({removed.length})</p>
                      <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                        {removed.map((item, i) => (
                          <li key={i} className="text-xs text-zinc-300">
                            <span className="font-mono">{item.plate}</span>
                            {item.name ? ` — ${item.name}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {changed.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-yellow-400">🔄 Alterados ({changed.length})</p>
                      <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                        {changed.map((item, i) => (
                          <li key={i} className="text-xs text-zinc-300">
                            <span className="font-mono">{item.plate}</span>
                            {" — "}{item.field}:{" "}
                            <span className="text-zinc-500">"{item.from}"</span>
                            {" → "}
                            <span className="text-white">"{item.to}"</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {added.length === 0 && removed.length === 0 && changed.length === 0 && (
                    <p className="mt-4 text-sm text-zinc-500">Sem alterações registradas neste diff.</p>
                  )}
                </>
              );
            })()}

            <button
              onClick={() => setDiffModalData(null)}
              className="mt-6 w-full rounded-xl bg-zinc-800 py-2 text-sm font-semibold transition hover:bg-zinc-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
