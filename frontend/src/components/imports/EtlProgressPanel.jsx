import { useEffect, useRef, useState } from "react";

import { getEtlStatus } from "../../services/etlStatusService";
import { ETL_STEPS, ETL_LABELS } from "../../constants/etlSteps";

const POLL_MS = 2000;

function formatDuration(ms) {
  if (ms == null) return "";
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}min ${sec}s` : `${sec}s`;
}

// Painel de progresso reutilizado em EtlTriggersCard.jsx e Grid.jsx —
// faz o proprio polling de GET /etl/status a cada 2s pro `type` dado,
// mostra o checklist de etapas, e chama onDone() uma unica vez quando
// o status sai de RUNNING (SUCCESS ou ERROR).
export default function EtlProgressPanel({ type, onReloadGrid, onRetry, onDone }) {

  const [entry, setEntry] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startedAtRef = useRef(null);
  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {

    startedAtRef.current = Date.now();
    doneRef.current = false;
    setElapsedMs(0);

    async function poll() {
      try {
        const list = await getEtlStatus();
        const found = Array.isArray(list) ? list.find((s) => s.type === type) : null;
        setEntry(found || null);

        if (found && found.status !== "RUNNING" && !doneRef.current) {
          doneRef.current = true;
          clearInterval(pollRef.current);
          clearInterval(tickRef.current);
          onDone?.(found);
        }
      } catch (err) {
        console.error(err);
      }
    }

    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(tickRef.current);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const steps = ETL_STEPS[type] || ["Processando", "Concluído"];
  const label = ETL_LABELS[type] || type;
  const status = entry?.status || "RUNNING";
  const currentStep = entry?.currentStep;

  const currentIdx = currentStep
    ? steps.findIndex((s) => currentStep === s || currentStep.startsWith(s))
    : -1;

  const pct = status === "SUCCESS"
    ? 100
    : currentIdx >= 0
      ? Math.round(((currentIdx + 1) / steps.length) * 100)
      : 5;

  if (status === "SUCCESS") {
    return (
      <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-2">
        <p className="font-semibold text-green-400">✅ {label} ATUALIZADO(A)!</p>
        <p className="text-xs text-zinc-400">
          {entry?.lastRecordsProcessed != null && `${entry.lastRecordsProcessed} registro(s) processado(s)`}
          {entry?.lastRecordsProcessed != null && entry?.lastDurationMs != null ? " • " : ""}
          {entry?.lastDurationMs != null && `durou ${formatDuration(entry.lastDurationMs)}`}
        </p>
        {onReloadGrid && (
          <button
            onClick={onReloadGrid}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200"
          >
            Atualizar grid agora
          </button>
        )}
      </div>
    );
  }

  if (status === "ERROR") {
    return (
      <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
        <p className="font-semibold text-red-400">❌ ERRO NA ATUALIZAÇÃO</p>
        <p className="text-xs text-zinc-400">Mensagem: {entry?.lastError || "erro desconhecido"}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-800"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950 p-4 space-y-2">
      <p className="font-semibold text-zinc-200">🔄 ATUALIZANDO {label}</p>
      <div className="h-px bg-zinc-800" />
      <div className="space-y-1">
        {steps.map((step, i) => {
          const icon = i < currentIdx ? "✅" : i === currentIdx ? "🔄" : "⬜";
          return (
            <p key={step} className={`text-xs ${i === currentIdx ? "text-white" : "text-zinc-500"}`}>
              {icon} {i === currentIdx ? currentStep : step}{i === currentIdx ? "..." : ""}
            </p>
          );
        })}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-zinc-500">{pct}% • {formatDuration(elapsedMs)}</p>
    </div>
  );
}
