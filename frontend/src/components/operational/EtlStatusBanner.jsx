import { useEffect, useState } from "react";

import { AlertTriangle } from "lucide-react";

import { getLastSync } from "../../services/importStatusService";

const STALE_HOURS = 2;
const POLL_INTERVAL_MS = 60000;

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

      const data = await getLastSync();

      setLastSync(data.lastSync);

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
    ? "ETL nunca sincronizou — verifique se o serviço está rodando"
    : `ETL parado há ${elapsedHours.toFixed(1)}h — verifique se o serviço está rodando`;

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
