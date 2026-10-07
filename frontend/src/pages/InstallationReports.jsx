import { useState } from "react";

import toast from "react-hot-toast";

import { FileSpreadsheet, FileText, Search } from "lucide-react";

import { getInstallationReport } from "../services/installationService";

import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";

import { todayForFilename } from "../utils/exportXlsx";

import { formatLocalDateTime } from "../utils/dateUtils";

const STATUS_LABELS = {
  PENDING: "Pendente",
  SCHEDULED: "Agendado",
  SENT: "Enviado",
  CANCELLED: "Cancelado",
};

const HEADERS = [
  "Data entrada",
  "Nome",
  "Placa",
  "Modelo",
  "Telefone",
  "Endereço",
  "Bairro",
  "Cidade/UF",
  "CEP",
  "Status",
  "Enviado por",
  "Data envio",
];

function toRow(inst) {
  return [
    inst.portalCreatedAt
      ? formatLocalDateTime(inst.portalCreatedAt)
      : inst.createdAt
      ? formatLocalDateTime(inst.createdAt)
      : "--",
    inst.customerName || "--",
    inst.plate || "--",
    inst.model || "--",
    inst.phone || "--",
    inst.address || "--",
    inst.neighborhood || "--",
    inst.city && inst.state ? `${inst.city}/${inst.state}` : inst.city || "--",
    inst.zipCode || "--",
    STATUS_LABELS[inst.status] || inst.status,
    inst.sentBy || "--",
    inst.sentAt ? formatLocalDateTime(inst.sentAt) : "--",
  ];
}

export default function InstallationReports() {

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setLoading(true);
    try {
      const data = await getInstallationReport({ search, status, startDate, endDate });
      setResults(data);
      setSearched(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao buscar instalações");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSearch();
  }

  const filters = {
    ...(search ? { Busca: search } : {}),
    ...(status ? { Status: STATUS_LABELS[status] || status } : {}),
    ...(startDate ? { De: startDate } : {}),
    ...(endDate ? { Até: endDate } : {}),
  };

  async function handleExcelExport() {
    if (results.length === 0) {
      toast.error("Nenhum resultado para exportar");
      return;
    }
    try {
      await exportReportToExcel({
        title: "Relatório de Instalações",
        headers: HEADERS,
        rows: results.map(toRow),
        filters,
        filename: `instalacoes-${todayForFilename()}.xlsx`,
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar Excel");
    }
  }

  function handlePdfExport() {
    if (results.length === 0) {
      toast.error("Nenhum resultado para exportar");
      return;
    }
    try {
      exportReportToPdf({
        title: "Relatório de Instalações",
        headers: HEADERS,
        rows: results.map(toRow),
        filters,
        filename: `instalacoes-${todayForFilename()}.pdf`,
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar PDF");
    }
  }

  return (
    <div className="space-y-6">

      {/* Filtros */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs text-zinc-500">Busca</label>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
              <Search size={14} className="shrink-0 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nome, placa ou cidade..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendentes</option>
              <option value="SENT">Enviados</option>
              <option value="CANCELLED">Cancelados</option>
              <option value="SCHEDULED">Agendados</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">Período</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
              />
              <span className="shrink-0 text-zinc-500">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">

          <button
            onClick={handleSearch}
            disabled={loading}
            className="rounded-2xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>

          {results.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleExcelExport}
                className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
              >
                <FileSpreadsheet size={15} />
                Excel
              </button>
              <button
                onClick={handlePdfExport}
                className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
              >
                <FileText size={15} />
                PDF
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Resultados */}
      {searched && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

          {results.length === 0 ? (

            <p className="py-10 text-center text-zinc-500">Nenhum resultado encontrado</p>

          ) : (
            <>
              <div className="border-b border-zinc-800 px-5 py-3">
                <p className="text-sm text-zinc-400">
                  {results.length} resultado{results.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-950 text-left text-xs text-zinc-400">
                    <tr>
                      {HEADERS.map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((inst) => (
                      <tr
                        key={inst.id}
                        className="border-t border-zinc-800 transition hover:bg-zinc-800/40"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {inst.portalCreatedAt
                            ? formatLocalDateTime(inst.portalCreatedAt)
                            : inst.createdAt
                            ? formatLocalDateTime(inst.createdAt)
                            : "--"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {inst.customerName || "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">
                          {inst.plate || "--"}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {inst.model || "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {inst.phone || "--"}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {inst.address || "--"}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {inst.neighborhood || "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {inst.city && inst.state
                            ? `${inst.city}/${inst.state}`
                            : inst.city || "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {inst.zipCode || "--"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={inst.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {inst.sentBy || "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {inst.sentAt ? formatLocalDateTime(inst.sentAt) : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      )}

    </div>
  );

}

function StatusBadge({ status }) {

  const map = {
    PENDING:   { label: "Pendente",  cls: "bg-yellow-500/15 text-yellow-400" },
    SCHEDULED: { label: "Agendado",  cls: "bg-blue-500/15 text-blue-400" },
    SENT:      { label: "Enviado",   cls: "bg-green-500/15 text-green-400" },
    CANCELLED: { label: "Cancelado", cls: "bg-zinc-700/40 text-zinc-400" },
  };

  const { label, cls } = map[status] || { label: status, cls: "bg-zinc-700/40 text-zinc-400" };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );

}
