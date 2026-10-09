import { useState } from "react";

import toast from "react-hot-toast";

import { FileSpreadsheet, FileText, Search } from "lucide-react";

import { getInstallationReport } from "../services/serviceOrderService";

import { exportReportToExcel, exportReportToPdf } from "../utils/reportExport";

import { todayForFilename } from "../utils/exportXlsx";

import { formatLocalDateTime } from "../utils/dateUtils";

import { PORTAL_STATUSES, portalStatusLabel } from "../utils/portalStatus";

// Relatorio das OS de instalacao (GET /service-orders/installation-report)
// — mesma fonte da tela de Instalacoes, com portalStatus, tecnico e
// valores de deslocamento/aprovacao da OS.

const APPROVAL_LABELS = {
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  PENDENTE: "Pendente",
};

const HEADERS = [
  "Data entrada",
  "Segurado",
  "Placa",
  "Cidade/UF",
  "Técnico",
  "Status portal",
  "Distância",
  "Deslocamento",
  "Aprovação",
  "Valor total",
];

function formatBRL(value) {
  if (value == null) return "--";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatKm(value) {
  return value != null ? `${value} km` : "--";
}

function cityState(so) {
  return so.city && so.state ? `${so.city}/${so.state}` : so.city || "--";
}

function toRow(so) {
  return [
    so.createdAt ? formatLocalDateTime(so.createdAt) : "--",
    so.customerName || "--",
    so.plate || "--",
    cityState(so),
    so.technician?.name || "--",
    portalStatusLabel(so.portalStatus),
    formatKm(so.distanceKm),
    formatBRL(so.displacementValue),
    APPROVAL_LABELS[so.financialApprovalStatus] || so.financialApprovalStatus || "--",
    formatBRL(so.totalValue),
  ];
}

export default function InstallationReports() {

  const [search, setSearch] = useState("");
  const [portalStatus, setPortalStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setLoading(true);
    try {
      const data = await getInstallationReport({ search, portalStatus, startDate, endDate });
      setResults(Array.isArray(data) ? data : []);
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

  // "Apenas deslocamentos aprovados" filtra no browser sobre o resultado
  // ja buscado — totalizadores e exportacao usam essa lista filtrada.
  const rows = approvedOnly
    ? results.filter((so) => so.financialApprovalStatus === "APROVADO")
    : results;

  const approved = rows.filter((so) => so.financialApprovalStatus === "APROVADO");
  const totals = {
    count: rows.length,
    approvedCount: approved.length,
    approvedDisplacement: approved.reduce((sum, so) => sum + Number(so.displacementValue ?? 0), 0),
    totalValue: rows.reduce((sum, so) => sum + Number(so.totalValue ?? 0), 0),
  };

  const filters = {
    ...(search ? { Busca: search } : {}),
    ...(portalStatus ? { "Status portal": portalStatusLabel(portalStatus) } : {}),
    ...(startDate ? { De: startDate } : {}),
    ...(endDate ? { Até: endDate } : {}),
    ...(approvedOnly ? { Deslocamentos: "Apenas aprovados" } : {}),
  };

  async function handleExcelExport() {
    if (rows.length === 0) {
      toast.error("Nenhum resultado para exportar");
      return;
    }
    try {
      await exportReportToExcel({
        title: "Relatório de Instalações",
        headers: HEADERS,
        rows: rows.map(toRow),
        filters,
        filename: `instalacoes-${todayForFilename()}.xlsx`,
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar Excel");
    }
  }

  function handlePdfExport() {
    if (rows.length === 0) {
      toast.error("Nenhum resultado para exportar");
      return;
    }
    try {
      exportReportToPdf({
        title: "Relatório de Instalações",
        headers: HEADERS,
        rows: rows.map(toRow),
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
            <label className="mb-1.5 block text-xs text-zinc-500">Status do portal</label>
            <select
              value={portalStatus}
              onChange={(e) => setPortalStatus(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            >
              <option value="">Todos</option>
              {PORTAL_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">Período (entrada da OS)</label>
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

        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={approvedOnly}
            onChange={(e) => setApprovedOnly(e.target.checked)}
            className="h-4 w-4 accent-white"
          />
          Apenas deslocamentos aprovados
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">

          <button
            onClick={handleSearch}
            disabled={loading}
            className="rounded-2xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>

          {rows.length > 0 && (
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

      {/* Totalizadores — sobre os resultados filtrados */}
      {searched && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Total de OS" value={totals.count} />
          <TotalCard label="Deslocamentos aprovados" value={totals.approvedCount} />
          <TotalCard label="Valor deslocamentos aprovados" value={formatBRL(totals.approvedDisplacement)} />
          <TotalCard label="Valor total geral" value={formatBRL(totals.totalValue)} />
        </div>
      )}

      {/* Resultados */}
      {searched && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

          {rows.length === 0 ? (

            <p className="py-10 text-center text-zinc-500">Nenhum resultado encontrado</p>

          ) : (
            <>
              <div className="border-b border-zinc-800 px-5 py-3">
                <p className="text-sm text-zinc-400">
                  {rows.length} resultado{rows.length !== 1 ? "s" : ""}
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
                    {rows.map((so) => (
                      <tr
                        key={so.id}
                        className="border-t border-zinc-800 transition hover:bg-zinc-800/40"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {so.createdAt ? formatLocalDateTime(so.createdAt) : "--"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {so.customerName || "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">
                          {so.plate || "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {cityState(so)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {so.technician?.name || "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {portalStatusLabel(so.portalStatus)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {formatKm(so.distanceKm)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {formatBRL(so.displacementValue)}
                        </td>
                        <td className="px-4 py-3">
                          <ApprovalBadge status={so.financialApprovalStatus} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">
                          {formatBRL(so.totalValue)}
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

function TotalCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function ApprovalBadge({ status }) {

  const map = {
    APROVADO:  { label: "Aprovado",  cls: "bg-green-500/15 text-green-400" },
    REPROVADO: { label: "Reprovado", cls: "bg-red-500/15 text-red-400" },
    PENDENTE:  { label: "Pendente",  cls: "bg-yellow-500/15 text-yellow-400" },
  };

  const { label, cls } = map[status] || { label: status || "—", cls: "bg-zinc-700/40 text-zinc-400" };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );

}
