import { useEffect, useState } from "react";

import { AlertTriangle } from "lucide-react";

import { getEtlStatus } from "../../services/etlStatusService";

const STALE_HOURS = 2;
const POLL_INTERVAL_MS = 60000;

// Instalações é o único import que ainda roda sozinho (cron a cada
// 30min no backend) — Dispositivos/Vínculos/Posição viraram manual-only
// (Import Center) e não fazem mais sentido aqui. O heartbeat de
// Instalações fica em etl_status (GET /etl/status), não em
// import_history (usado por getLastSync) — INSTALACOES nunca gravou
// nessa segunda tabela, então o banner antigo ficava vermelho mesmo
// com tudo funcionando, só porque ninguém tinha clicado manualmente
// em Dispositivos/Vínculos nas últimas 2h.
const MONITORED_TYPE = "INSTALACOES";

function hoursAgo(value) {

  if (!value) {
    return null;
  }

  return (Date.now() - new Date(value).getTime()) / 3600000;

}

export default function EtlStatusBanner() {

  const [lastSync, setLastSync] =
    useState(undefined); // undefined = ainda não checou

  async function check() {

    try {

      const list = await getEtlStatus();

      const entry = Array.isArray(list)
        ? list.find((s) => s.type === MONITORED_TYPE)
        : null;

      setLastSync(entry?.lastRunAt ?? null);

    } catch (error) {

      console.error(error);

    }

  }

  useEffect(() => {

    check();

    const interval = setInterval(check, POLL_INTERVAL_MS);

    return () => clearInterval(interval);

  }, []);

  if (lastSync === undefined) {
    return null; // ainda não sabemos o estado, não mostra nada
  }

  const elapsedHours = hoursAgo(lastSync);

  const isStale = elapsedHours === null || elapsedHours > STALE_HOURS;

  if (!isStale) {
    return null;
  }

  const message = elapsedHours === null
    ? "Sync de Instalações nunca rodou — verifique se o serviço está rodando"
    : `Sync de Instalações parado há ${elapsedHours.toFixed(1)}h — verifique se o serviço está rodando`;

  return (
    <div
      className="
        flex items-center justify-center gap-2
        bg-red-600 px-4 py-2
        text-sm font-semibold text-white
      "
    >
      <AlertTriangle size={16} />
      {message}
    </div>
  );

}
