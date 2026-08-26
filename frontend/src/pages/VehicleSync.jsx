import { useEffect, useRef, useState } from "react";

import toast from "react-hot-toast";

import { RefreshCw } from "lucide-react";

import {
  acceptAllPortalDiffs,
  acceptPortalDiff,
  getPortalSyncDiffs,
  getPortalSyncStatus,
  rejectPortalDiff,
  startPortalSync,
} from "../services/vehiclePortalSyncService";

const FIELD_LABEL = {
  city: "Cidade",
  state: "Estado",
  zipCode: "CEP",
  cpfCnpj: "CPF/CNPJ",
  portalPolicyNumber: "Número da Apólice",
  portalStartDate: "Início de Vigência",
  portalEndDate: "Fim de Vigência",
  vehicleModel: "Modelo",
  vehicleBrand: "Marca",
};

const POLL_MS = 2000;

export default function VehicleSync() {

  const [diffs, setDiffs] = useState([]);
  const [loadingDiffs, setLoadingDiffs] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(null); // { processed, total, status, result }
  const [processingId, setProcessingId] = useState(null); // diff id | "all"

  const pollRef = useRef(null);

  async function loadDiffs() {
    setLoadingDiffs(true);
    try {
      const data = await getPortalSyncDiffs();
      setDiffs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar diferenças pendentes");
    } finally {
      setLoadingDiffs(false);
    }
  }

  useEffect(() => {
    loadDiffs();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleSync() {
    setSyncing(true);
    setProgress({ processed: 0, total: 0, status: "RUNNING" });
    try {
      const { jobId } = await startPortalSync();

      pollRef.current = setInterval(async () => {
        try {
          const job = await getPortalSyncStatus(jobId);
          setProgress(job);

          if (job.status === "DONE" || job.status === "ERROR" || job.status === "NOT_FOUND") {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setSyncing(false);

            if (job.status === "DONE") {
              const r = job.result;
              toast.success(
                r
                  ? `Sincronização concluída — ${r.vehiclesWithDiff} veículo(s) com diferença, ${r.diffsCreated} campo(s) novo(s)`
                  : "Sincronização concluída"
              );
              loadDiffs();
            } else {
              toast.error("Falha ao sincronizar com o portal");
            }
          }
        } catch (err) {
          console.error(err);
          clearInterval(pollRef.current);
          pollRef.current = null;
          setSyncing(false);
          toast.error("Erro ao acompanhar sincronização");
        }
      }, POLL_MS);

    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Erro ao iniciar sincronização");
      setSyncing(false);
      setProgress(null);
    }
  }

  async function handleAccept(id) {
    setProcessingId(id);
    try {
      await acceptPortalDiff(id);
      toast.success("Alteração aceita");
      setDiffs((cur) => cur.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Erro ao aceitar alteração");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id) {
    setProcessingId(id);
    try {
      await rejectPortalDiff(id);
      toast.success("Alteração rejeitada");
      setDiffs((cur) => cur.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Erro ao rejeitar alteração");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleAcceptAll() {
    setProcessingId("all");
    try {
      const { accepted } = await acceptAllPortalDiffs();
      toast.success(`${accepted} alteração(ões) aceita(s)`);
      setDiffs([]);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Erro ao aceitar todas as alterações");
    } finally {
      setProcessingId(null);
    }
  }

  const progressPct = progress?.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sincronizar Cadastro</h1>
          <p className="text-zinc-400 mt-1">
            Compara os veículos operacionais com os dados do portal parceiro e propõe atualizações de cadastro.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando..." : "Sincronizar com Portal"}
        </button>
      </div>

      {progress && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>
              {progress.status === "RUNNING" && `Processando ${progress.processed} de ${progress.total || "?"}...`}
              {progress.status === "DONE" && "Sincronização concluída"}
              {progress.status === "ERROR" && "Falha na sincronização"}
            </span>
            {progress.total > 0 && <span>{progressPct}%</span>}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${progress.status === "ERROR" ? "bg-red-500" : "bg-white"}`}
              style={{ width: `${progress.status === "DONE" ? 100 : progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Diferenças Pendentes {!loadingDiffs && `(${diffs.length})`}
          </h2>
          {diffs.length > 0 && (
            <button
              onClick={handleAcceptAll}
              disabled={processingId === "all"}
              className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              ✅ Aceitar Todas
            </button>
          )}
        </div>

        {loadingDiffs ? (
          <p className="py-10 text-center text-zinc-500">Carregando...</p>
        ) : diffs.length === 0 ? (
          <p className="py-10 text-center text-zinc-500">Nenhuma diferença pendente</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Campo</th>
                  <th className="px-4 py-3">Valor Atual</th>
                  <th className="px-4 py-3">Valor do Portal</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-mono font-semibold">{d.plate}</td>
                    <td className="px-4 py-3 text-zinc-400">{FIELD_LABEL[d.field] || d.field}</td>
                    <td className="px-4 py-3 text-zinc-500">{d.currentValue || <span className="text-zinc-700">vazio</span>}</td>
                    <td className="px-4 py-3 text-green-400 font-medium">{d.newValue}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(d.id)}
                          disabled={processingId === d.id || processingId === "all"}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
                        >
                          ✅ Aceitar
                        </button>
                        <button
                          onClick={() => handleReject(d.id)}
                          disabled={processingId === d.id || processingId === "all"}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          ❌ Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
