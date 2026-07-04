import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { FileSpreadsheet, FileText, Plus, Trash2, X } from "lucide-react";

import {
  closeMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceRecords,
} from "../services/maintenanceService";

import {
  todayForFilename,
} from "../utils/exportXlsx";

import MaintenanceModal from "../components/maintenance/MaintenanceModal";

import Pagination from "../components/ui/Pagination";

import { usePagination } from "../hooks/usePagination";

import { formatLocalDate as formatDate } from "../utils/dateUtils";

import { realtimeService } from "../services/realtime/realtimeService";

function daysUntil(value) {

  if (!value) {
    return null;
  }

  const diff = new Date(value).getTime() - Date.now();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));

}

function rowHighlight(record) {

  if (record.status !== "ABERTO") {
    return "";
  }

  const days = daysUntil(record.prazoEncerramento);

  if (days == null) {
    return "";
  }

  if (days <= 0) {
    return "bg-red-500/10 hover:bg-red-500/15";
  }

  if (days <= 2) {
    return "bg-yellow-500/10 hover:bg-yellow-500/15";
  }

  return "";

}

export default function Maintenance() {

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [showClosed, setShowClosed] = useState(false);

  const [modalRecord, setModalRecord] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);

  const {
    page,
    setPage,
    totalPages,
    pageItems,
    pageSize,
    totalItems,
  } = usePagination(records);

  async function load() {

    setLoading(true);

    try {

      const data = await getMaintenanceRecords(showClosed);

      setRecords(data);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar manutenções");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, [showClosed]);

  useEffect(() => {

    const unsubscribe = realtimeService.onDashboardEvent((event) => {

      if (event?.type === "GRID_UPDATED") {

        load();

      }

    });

    return () => unsubscribe();

  }, [showClosed]);

  function openCreate() {

    setModalRecord(null);

    setModalOpen(true);

  }

  function openEdit(record) {

    setModalRecord(record);

    setModalOpen(true);

  }

  async function handleClose(id) {

    if (!window.confirm("Encerrar esta manutenção?")) {
      return;
    }

    try {

      await closeMaintenanceRecord(id);

      toast.success("Manutenção encerrada");

      load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao encerrar manutenção");

    }

  }

  async function handleDelete(id) {

    if (!window.confirm("Remover este registro de manutenção?")) {
      return;
    }

    try {

      await deleteMaintenanceRecord(id);

      toast.success("Registro removido");

      load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao remover registro");

    }

  }

  function buildExportData() {

    const headers = [
      "DATA",
      "PLACA",
      "SEGURADO",
      "MODELO",
      "LOCAL/POSIÇÃO",
      "CIDADE-UF",
      "PRAZO DE ENCERRAMENTO",
      "BASE",
      "OPERADOR",
      "STATUS",
      "DATA DE ENCERRAMENTO",
    ];

    const rows = records.map((record) => [
      formatDate(record.data),
      record.plate,
      record.insuredName || "",
      record.modelo || "",
      record.localPosicao || "",
      record.cidadeUf || "",
      formatDate(record.prazoEncerramento),
      record.base || "",
      record.operador || "",
      record.status,
      formatDate(record.dataEncerramento),
    ]);

    const filters = {
      "Mostrar encerradas": showClosed ? "Sim" : "Não",
    };

    return { headers, rows, filters };

  }

  async function handleExportExcel() {

    const { headers, rows, filters } = buildExportData();

    const { exportReportToExcel } = await import("../utils/reportExport");

    exportReportToExcel({
      title: "Manutenção",
      headers,
      rows,
      filters,
      filename: `MANUTENCAO_${todayForFilename()}.xlsx`,
    });

  }

  async function handleExportPdf() {

    const { headers, rows, filters } = buildExportData();

    const { exportReportToPdf } = await import("../utils/reportExport");

    exportReportToPdf({
      title: "Manutenção",
      headers,
      rows,
      filters,
      filename: `MANUTENCAO_${todayForFilename()}.pdf`,
    });

  }

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-end gap-4">

        <div className="flex items-center gap-3">

          <label
            className="
              flex items-center gap-2
              rounded-2xl border border-zinc-700
              bg-zinc-950 px-4 py-3
              text-sm font-medium text-zinc-300
            "
          >
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
              className="rounded border-zinc-700"
            />
            Mostrar encerradas
          </label>

          <button
            onClick={handleExportExcel}
            className="
              flex items-center gap-2
              rounded-2xl border border-zinc-700
              bg-zinc-950 px-5 py-3
              text-sm font-semibold
              transition hover:bg-zinc-800
            "
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>

          <button
            onClick={handleExportPdf}
            className="
              flex items-center gap-2
              rounded-2xl border border-zinc-700
              bg-zinc-950 px-5 py-3
              text-sm font-semibold
              transition hover:bg-zinc-800
            "
          >
            <FileText size={16} />
            PDF
          </button>

          <button
            onClick={openCreate}
            className="
              flex items-center gap-2
              rounded-2xl bg-white px-5 py-3
              text-sm font-semibold text-black
              transition hover:opacity-90
            "
          >
            <Plus size={16} />
            Nova Manutenção
          </button>

        </div>

      </div>

      <div
        className="
          overflow-hidden rounded-2xl
          border border-zinc-800 bg-zinc-900
        "
      >

        <div className="max-h-[36rem] overflow-auto">

          <table className="min-w-full">

            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr className="text-left text-sm text-zinc-400">
                <th className="px-4 py-4">Data</th>
                <th className="px-4 py-4">Placa</th>
                <th className="px-4 py-4">Segurado</th>
                <th className="px-4 py-4">Modelo</th>
                <th className="px-4 py-4">Local/Posição</th>
                <th className="px-4 py-4">Cidade-UF</th>
                <th className="px-4 py-4">Prazo</th>
                <th className="px-4 py-4">Base</th>
                <th className="px-4 py-4">Operador</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Ações</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-10 text-center text-zinc-500">
                    Carregando...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-10 text-center text-zinc-500">
                    Nenhum veículo em manutenção
                  </td>
                </tr>
              ) : (
                pageItems.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => openEdit(record)}
                    className={`
                      cursor-pointer border-t border-zinc-800
                      transition
                      ${rowHighlight(record)}
                    `}
                  >
                    <td className="px-4 py-4 text-zinc-400">
                      {formatDate(record.data)}
                    </td>
                    <td className="px-4 py-4 font-mono font-semibold">
                      {record.plate}
                    </td>
                    <td className="px-4 py-4">{record.insuredName || "--"}</td>
                    <td className="px-4 py-4">{record.modelo || "--"}</td>
                    <td className="px-4 py-4 text-zinc-400">
                      {record.localPosicao || "--"}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {record.cidadeUf || "--"}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {formatDate(record.prazoEncerramento)}
                    </td>
                    <td className="px-4 py-4">{record.base || "--"}</td>
                    <td className="px-4 py-4 text-zinc-400">
                      {record.operador || "--"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`
                          rounded-full px-3 py-1 text-xs font-semibold
                          ${record.status === "ABERTO"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-zinc-700/40 text-zinc-400"}
                        `}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td
                      className="px-4 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-2">

                        {record.status === "ABERTO" && (
                          <button
                            onClick={() => handleClose(record.id)}
                            title="Encerrar"
                            className="
                              rounded-xl border border-zinc-700
                              bg-zinc-950 p-2
                              text-zinc-400 transition
                              hover:bg-green-500/15 hover:text-green-400
                            "
                          >
                            <X size={14} />
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(record.id)}
                          title="Remover"
                          className="
                            rounded-xl border border-zinc-700
                            bg-zinc-950 p-2
                            text-zinc-400 transition
                            hover:bg-red-500/15 hover:text-red-400
                          "
                        >
                          <Trash2 size={14} />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))
              )}

            </tbody>

          </table>

        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />

      </div>

      {modalOpen && (
        <MaintenanceModal
          record={modalRecord}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}

    </div>
  );
}
