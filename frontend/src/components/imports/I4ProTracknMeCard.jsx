import { useState } from "react";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { triggerI4Pro, getEtlStatus } from "../../services/importStatusService";
import { notifyI4ProComplete } from "../../services/notificationService";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS  = 5 * 60 * 1000; // 5 minutos

async function waitForCompletion(beforeUpdatedAt) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const statuses = await getEtlStatus();
      const s = statuses.find(x => x.type === "I4PRO_TRACKNME");
      if (s && s.status !== "RUNNING") {
        const updatedAt = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
        if (updatedAt > beforeUpdatedAt) return s;
      }
    } catch {}
  }
  return null;
}

export default function I4ProTracknMeCard() {
  const [loading, setLoading] = useState(false);

  async function handleBulkTrigger() {
    setLoading(true);
    try {
      // Captura updatedAt atual antes de disparar para detectar conclusão nova
      let beforeUpdatedAt = 0;
      try {
        const statuses = await getEtlStatus();
        const cur = statuses.find(s => s.type === "I4PRO_TRACKNME");
        if (cur?.updatedAt) beforeUpdatedAt = new Date(cur.updatedAt).getTime();
      } catch {}

      await triggerI4Pro();
      toast("Busca i4pro iniciada — aguardando ETL...", { icon: "🔍" });

      const result = await waitForCompletion(beforeUpdatedAt);
      if (!result) {
        toast("Busca enviada — verifique o ETL Monitor para o resultado", { icon: "⏱️" });
        return;
      }

      if (result.status === "SUCCESS") {
        const populated = result.lastRecordsProcessed ?? 0;
        toast.success(`i4pro: ${populated} apólice(s) importada(s)`);
        notifyI4ProComplete(populated, 0);
      } else {
        toast.error(`Erro no ETL i4pro: ${result.lastError || "desconhecido"}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao solicitar busca i4pro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-xl font-semibold">i4pro — Apólices TracknMe</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Busca apólices no i4pro para todas as placas TracknMe sem segurado cadastrado
        </p>
      </div>

      <div className="mt-6">
        <button
          onClick={handleBulkTrigger}
          disabled={loading}
          className="
            flex items-center gap-2
            rounded-2xl border border-zinc-700
            bg-zinc-950 px-5 py-3
            text-sm font-semibold
            transition hover:bg-zinc-800
            disabled:opacity-50
          "
        >
          <Search size={14} className={loading ? "animate-pulse" : ""} />
          {loading ? "Buscando apólices..." : "Buscar Apólices TracknMe"}
        </button>
      </div>
    </div>
  );
}
