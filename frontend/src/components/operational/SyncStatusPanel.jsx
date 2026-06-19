import { useEffect, useState } from "react";

import { RefreshCw } from "lucide-react";

import {
  getLastSync,
  triggerImport,
} from "../../services/importStatusService";

const SYNC_TYPE = "MULTIPORTAL_OPERATIONAL";

function formatDateTime(value) {

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }) + " " + date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

}

function computeStatus(lastSync) {

  if (!lastSync) {

    return {
      color: "bg-red-500",
      text: "Sem sincronização registrada",
    };

  }

  const minutesAgo =
    (Date.now() - new Date(lastSync).getTime()) / 60000;

  if (minutesAgo < 35) {

    return {
      color: "bg-green-500",
      text: `Dados atualizados · última sincronização: ${formatDateTime(lastSync)}`,
    };

  }

  if (minutesAgo < 120) {

    return {
      color: "bg-yellow-500",
      text: `Sincronização atrasada · última: ${formatDateTime(lastSync)}`,
    };

  }

  return {
    color: "bg-red-500",
    text: `Sem sincronização recente · última: ${formatDateTime(lastSync)}`,
  };

}

export default function SyncStatusPanel({ onSynced }) {

  const [lastSync, setLastSync] =
    useState(null);

  const [now, setNow] =
    useState(Date.now());

  const [triggering, setTriggering] =
    useState(false);

  useEffect(() => {

    loadLastSync();

    const tick = setInterval(
      () => setNow(Date.now()),
      30000
    );

    return () => clearInterval(tick);

  }, []);

  async function loadLastSync() {

    try {

      const data = await getLastSync(SYNC_TYPE);

      setLastSync(data.lastSync);

    } catch (error) {

      console.error(error);

    }

  }

  async function handleTrigger() {

    setTriggering(true);

    try {

      await triggerImport(SYNC_TYPE);

      setTimeout(async () => {

        await loadLastSync();

        onSynced?.();

        setTriggering(false);

      }, 5000);

    } catch (error) {

      console.error(error);

      setTriggering(false);

    }

  }

  const status = computeStatus(lastSync, now);

  return (
    <div
      className="
        flex flex-col items-start
        justify-between gap-3
        rounded-2xl border
        border-zinc-800
        bg-zinc-900 p-4
        sm:flex-row sm:items-center
      "
    >

      <div className="flex items-center gap-2 text-sm">

        <span
          className={`
            h-2.5 w-2.5 rounded-full
            ${status.color}
          `}
        />

        <span className="text-zinc-300">
          {status.text}
        </span>

      </div>

      <button
        onClick={handleTrigger}
        disabled={triggering}
        className="
          flex items-center gap-2
          rounded-2xl border
          border-zinc-700
          bg-zinc-950 px-4 py-2
          text-sm font-semibold
          transition
          hover:bg-zinc-800
          disabled:opacity-50
        "
      >
        <RefreshCw
          size={14}
          className={triggering ? "animate-spin" : ""}
        />
        {triggering ? "Atualizando..." : "Atualizar agora"}
      </button>

    </div>
  );
}
