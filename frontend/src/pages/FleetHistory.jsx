import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { X } from "lucide-react";

import { getFleetHistory } from "../services/reportsService";

import { todayForFilename } from "../utils/exportXlsx";

const TYPE_LABEL = {
  MULTIPORTAL_DEVICE:  "Dispositivos",
  MULTIPORTAL_LINKAGE: "Vínculo",
};

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

function PlateChips({ items, colorClass }) {
  if (!items?.length) return <p className="text-sm text-zinc-500">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className={`rounded-lg px-2 py-1 text-xs font-mono ${colorClass}`}
        >
          {item.plate ?? JSON.stringify(item)}
        </span>
      ))}
    </div>
  );
}

function DetailsModal({ log, onClose }) {
  if (!log) return null;
  const details = parseDetails(log);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Detalhes do Sync</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {new Date(log.createdAt).toLocaleString("pt-BR")}
              {" · "}
              {TYPE_LABEL[log.importType] ?? log.importType}
            </p>
          </div>
          <button onClick={onClose}>
            <X size={20} className="text-zinc-400 hover:text-white" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {details.added?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-400">
                Entraram ({details.added.length})
              </p>
              <PlateChips items={details.added} colorClass="bg-green-500/10 text-green-300" />
            </div>
          )}
          {details.removed?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                Saíram ({details.removed.length})
              </p>
              <PlateChips items={details.removed} colorClass="bg-red-500/10 text-red-300" />
            </div>
          )}
          {details.changed?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-yellow-400">
                Alterados ({details.changed.length})
              </p>
              <PlateChips items={details.changed} colorClass="bg-yellow-500/10 text-yellow-300" />
            </div>
          )}
          {!details.added?.length && !details.removed?.length && !details.changed?.length && (
            <p className="text-sm text-zinc-500">Nenhum detalhe disponível</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FleetHistory() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => { load("", ""); }, []);

  async function load(from, to) {
    setLoading(true);
    try {
      const data = await getFleetHistory({ dateFrom: from || undefined, dateTo: to || undefined });
      setLogs(data);
    } catch {
      toast.error("Erro ao carregar histórico de frota");
    } finally {
      setLoading(false);
    }
  }

  function handleFilter() { load(dateFrom, dateTo); }

  function handleClear() {
    setDateFrom("");
    setDateTo("");
    load("", "");
  }

  async function handleExportExcel() {
    const { exportReportToExcel } = await import("../utils/reportExport");
    const headers = ["Data/Hora", "Tipo", "Entraram", "Saíram", "Alterados"];
    const rows = logs.map(l => [
      new Date(l.createdAt).toLocaleString("pt-BR"),
      TYPE_LABEL[l.importType] ?? l.importType,
      l.added,
      l.removed,
      l.changed,
    ]);
    exportReportToExcel({
      title: "Histórico de Frota Multiportal",
      headers,
      rows,
      filters: { De: dateFrom || "Todos", Até: dateTo || "Todos" },
      filename: `historico-frota-${todayForFilename()}.xlsx`,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Histórico de Frota</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Entradas, saídas e alterações registradas nos syncs Multiportal
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Até</label>
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
          <button
            onClick={handleExportExcel}
            disabled={logs.length === 0}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800 disabled:opacity-40"
          >
            Excel
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950 text-left text-xs text-zinc-500 uppercase tracking-wider">
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
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
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
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                    {TYPE_LABEL[log.importType] ?? log.importType}
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

      <DetailsModal log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
