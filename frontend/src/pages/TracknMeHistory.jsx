import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { getTracknMeHistory } from "../services/tracknmeService";
import { triggerImport } from "../services/importStatusService";
import toast from "react-hot-toast";

function parseDetails(log) {
  try {
    const d = typeof log.detailsJson === "string"
      ? JSON.parse(log.detailsJson)
      : log.detailsJson;
    return d || { added: [], removed: [], changed: [] };
  } catch {
    return { added: [], removed: [], changed: [] };
  }
}

export default function TracknMeHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadWithFilters("", ""); }, []);

  async function loadWithFilters(from, to) {
    setLoading(true);
    try {
      const data = await getTracknMeHistory({
        dateFrom: from || undefined,
        dateTo: to || undefined,
      });
      setLogs(data);
    } catch {
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }

  function handleFilter() {
    loadWithFilters(dateFrom, dateTo);
  }

  function handleClear() {
    setDateFrom("");
    setDateTo("");
    loadWithFilters("", "");
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerImport("TRACKNME");
      await triggerImport("TRACKNME_POSITION");
      toast.success("Sync TracknMe concluído");
      loadWithFilters(dateFrom, dateTo);
    } catch {
      toast.error("Erro ao sincronizar — verifique os logs");
    } finally {
      setSyncing(false);
    }
  }

  const selectedDetails = selected ? parseDetails(selected) : null;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Histórico TracknMe</h1>
          <p className="text-zinc-400 mt-1">{logs.length} registro(s)</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando..." : "Atualizar TracknMe"}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <button
          onClick={handleFilter}
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
        >
          Filtrar
        </button>
        {(dateFrom || dateTo) && (
          <button
            onClick={handleClear}
            className="text-xs text-zinc-500 hover:text-white"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Data/Hora</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-green-400">Entraram</th>
              <th className="px-4 py-3 text-red-400">Saíram</th>
              <th className="px-4 py-3 text-yellow-400">Alterados</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
            {!loading && logs.map(log => (
              <tr key={log.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400">
                    {log.importType === "TRACKNME" ? "Dispositivos" : "Posições"}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-green-400">
                  {log.added > 0 ? log.added : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3 font-semibold text-red-400">
                  {log.removed > 0 ? log.removed : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3 font-semibold text-yellow-400">
                  {log.changed > 0 ? log.changed : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {(log.added > 0 || log.removed > 0 || log.changed > 0) && (
                    <button
                      onClick={() => setSelected(log)}
                      className="rounded-lg border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                    >
                      Detalhes
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de detalhes */}
      {selected && selectedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Detalhes do Sync</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {new Date(selected.createdAt).toLocaleString("pt-BR")}
                  {" · "}
                  {selected.importType === "TRACKNME" ? "Dispositivos" : "Posições"}
                </p>
              </div>
              <button onClick={() => setSelected(null)}>
                <X size={20} className="text-zinc-400 hover:text-white" />
              </button>
            </div>

            {selectedDetails.added?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
                  Entraram ({selectedDetails.added.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDetails.added.map((item, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-green-500/10 px-2 py-1 text-xs font-mono text-green-300"
                    >
                      {item.plate ?? JSON.stringify(item)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedDetails.removed?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                  Saíram ({selectedDetails.removed.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDetails.removed.map((item, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-red-500/10 px-2 py-1 text-xs font-mono text-red-300"
                    >
                      {item.plate ?? JSON.stringify(item)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedDetails.changed?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">
                  Alterados ({selectedDetails.changed.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDetails.changed.map((item, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-yellow-500/10 px-2 py-1 text-xs font-mono text-yellow-300"
                    >
                      {item.plate ?? JSON.stringify(item)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!selectedDetails.added?.length &&
             !selectedDetails.removed?.length &&
             !selectedDetails.changed?.length && (
              <p className="text-sm text-zinc-500">Nenhum detalhe disponível</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
