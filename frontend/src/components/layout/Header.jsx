import { useEffect, useRef, useState } from "react";

import { useLocation } from "react-router-dom";

import toast from "react-hot-toast";

import { Bell, LogOut, Search } from "lucide-react";

import { useAuthStore } from "../../store/authStore";

import {
  dismissSignalReturnAlert,
  getActiveSignalReturnAlerts,
} from "../../services/signalReturnAlertService";

import { formatDelay } from "../../utils/formatDelay";

const POLL_INTERVAL_MS = 60000;

// Fonte única do título exibido no topo — cada página não renderiza
// mais seu próprio <h1>, evitando títulos duplicados/divergentes.
const PAGE_TITLES = [
  { match: /^\/(grid)?$/, title: "Grid Operacional", subtitle: "Consolidação operacional realtime" },
  { match: /^\/dashboard$/, title: "Central Operacional", subtitle: "Tudo que precisa da sua atenção neste turno" },
  { match: /^\/imports$/, title: "Import Center", subtitle: "Central operacional de importações" },
  { match: /^\/vehicles\/.+$/, title: "Detalhes do Veículo", subtitle: "" },
  { match: /^\/vehicles$/, title: "Veículos", subtitle: "Cadastro operacional consolidado" },
  { match: /^\/audit$/, title: "Monitoramento", subtitle: "Histórico de importações, mudanças pendentes e integridade dos dados" },
  { match: /^\/signal-control$/, title: "Controle de Sinais", subtitle: "Veículos sem comunicação há mais de 24h — fluxo de atendimento" },
  { match: /^\/letters$/, title: "Cartas de Suspensão", subtitle: "Controle de cartas de suspensão por cobertura" },
  { match: /^\/maintenance$/, title: "Manutenção", subtitle: "Veículos em manutenção de equipamento" },
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

  const [alerts, setAlerts] =
    useState([]);

  const [alertsOpen, setAlertsOpen] =
    useState(false);

  const [dismissingId, setDismissingId] =
    useState(null);

  const alertsRef = useRef(null);

  async function loadAlerts() {

    try {

      const data = await getActiveSignalReturnAlerts();

      setAlerts(data);

    } catch (error) {

      console.error(error);

    }

  }

  useEffect(() => {

    loadAlerts();

    const interval = setInterval(loadAlerts, POLL_INTERVAL_MS);

    return () => clearInterval(interval);

  }, []);

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

            {alerts.length > 0 && (
              <span
                className="
                  absolute -right-1 -top-1
                  flex h-5 w-5 items-center justify-center
                  rounded-full bg-red-500
                  text-xs font-bold text-white
                "
              >
                {alerts.length}
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

              <p className="px-2 py-1 text-xs font-semibold text-zinc-500">
                RETORNO DE SINAL
              </p>

              {alerts.length === 0 ? (

                <p className="px-2 py-4 text-center text-sm text-zinc-500">
                  Nenhum alerta ativo
                </p>

              ) : (

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

        <div
          className="
            flex items-center gap-3
            rounded-xl border border-zinc-800
            bg-zinc-950 px-4 py-2
          "
        >
          <div
            className="
              flex h-9 w-9 items-center
              justify-center rounded-full
              bg-zinc-800 font-bold
            "
          >
            {user?.name?.[0] || "U"}
          </div>

          <div>
            <p className="text-sm font-medium">
              {user?.name || "Usuário"}
            </p>

            <p className="text-xs text-zinc-500">
              {user?.role || "Operador"}
            </p>
          </div>
        </div>

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
    </header>
  );
}
