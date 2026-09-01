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
  const [showSuccess, setShowSuccess] = useState(false);

  const startedAtRef = useRef(null);
  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {

    startedAtRef.current = Date.now();
    doneRef.current = false;
    setElapsedMs(0);
    setShowSuccess(false);

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

  // So' revela a tela de sucesso 2s depois do SUCCESS chegar — sem isso,
  // quando o ETL reporta e conclui tudo entre um poll e outro, o painel
  // pula direto do "nada" pra tela final sem o usuario ver o checklist
  // completo. Nao mexe no polling em si (que ja parou nesse ponto,
  // ver poll() acima) — so' atrasa a troca visual.
  useEffect(() => {
    if (entry?.status !== "SUCCESS" || showSuccess) return;
    const id = setTimeout(() => setShowSuccess(true), 2000);
    return () => clearTimeout(id);
  }, [entry?.status, showSuccess]);

  const steps = ETL_STEPS[type] || ["Processando", "Concluído"];
  const label = ETL_LABELS[type] || type;
  const status = entry?.status || "RUNNING";

  // O backend acumula cada etapa reportada em ordem (EtlStatus
  // .stepsHistory) — usar esse historico em vez de so' o ultimo
  // currentStep evita que etapas intermediarias "sumam" quando o ETL
  // reporta mais rapido do que o polling de 2s consegue acompanhar.
  const history = Array.isArray(entry?.stepsHistory) ? entry.stepsHistory : [];

  // Quantas etapas do template estatico ja apareceram no historico —
  // so' pra saber quais faltam (exibidas em branco, ⬜, abaixo).
  const matchedCount = steps.filter((s) =>
    history.some((h) => h === s || h.startsWith(s))
  ).length;

  const pendingSteps = steps.slice(matchedCount);

  const pct = status === "SUCCESS"
    ? 100
    : history.length > 0
      ? Math.round((history.length / steps.length) * 100)
      : 5;

  if (status === "SUCCESS" && showSuccess) {
    return (
      <>
        <style>{`
          @keyframes etl-success-fade-in {
            from { opacity: 0; transform: translateY(-4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div
          className="mt-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-2"
          style={{ animation: "etl-success-fade-in 0.4s ease-out" }}
        >
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
      </>
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
        {status === "SUCCESS"
          // Ja chegou SUCCESS mas ainda dentro da janela de 2s antes de
          // revelar a tela final — mostra tudo concluido em vez de pular
          // direto pro painel de sucesso.
          ? steps.map((step) => (
              <p key={step} className="text-xs text-zinc-500">✅ {step}</p>
            ))
          : (
            <>
              {history.map((step, i) => {
                const isLast = i === history.length - 1;
                return (
                  <p key={`${step}-${i}`} className={`text-xs ${isLast ? "text-white" : "text-zinc-500"}`}>
                    {isLast ? "🔄" : "✅"} {step}{isLast ? "..." : ""}
                  </p>
                );
              })}
              {pendingSteps.map((step) => (
                <p key={step} className="text-xs text-zinc-500">⬜ {step}</p>
              ))}
            </>
          )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-zinc-500">{pct}% • {formatDuration(elapsedMs)}</p>
    </div>
  );
}
