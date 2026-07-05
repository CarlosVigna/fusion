import { useEffect, useRef, useState } from "react";

import toast from "react-hot-toast";

import { Archive, CalendarClock, FileSpreadsheet, FileText, Plus, RotateCcw, Trash2, X } from "lucide-react";

import {
  baixarMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceRecords,
  prorrogarMaintenanceRecord,
  reativarMaintenanceRecord,
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
    return record.status === "BAIXADA" ? "opacity-50" : "";
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

  const [baixandoId, setBaixandoId] = useState(null);

  const [confirmAction, setConfirmAction] = useState(null);

  const [prorrogarId, setProrrogarId] = useState(null);

  const [novoPrazo, setNovoPrazo] = useState("");

  const dateInputRef = useRef(null);

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

  async function executeBaixar(id) {

    setBaixandoId(id);

    try {

      await baixarMaintenanceRecord(id);

      toast.success("Manutenção baixada");

      load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dar baixa na manutenção");

    } finally {

      setBaixandoId(null);

    }

  }

  function handleBaixar(id) {

    setConfirmAction({
      message: "Dar baixa nesta manutenção? Esta ação pode ser desfeita usando o botão Reativar.",
      onConfirm: () => executeBaixar(id),
    });

  }

  async function handleReativar(id) {

    try {

      await reativarMaintenanceRecord(id);

      toast.success("Manutenção reativada");

      load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao reativar manutenção");

    }

  }

  function openProrrogar(id) {

    setProrrogarId(id);

    setNovoPrazo("");

    setTimeout(() => dateInputRef.current?.focus(), 50);

  }

  function cancelProrrogar() {

    setProrrogarId(null);

    setNovoPrazo("");

  }

  async function confirmProrrogar() {

    if (!novoPrazo) {
      toast.error("Informe a nova data de prazo");
      return;
    }

    setBaixandoId(prorrogarId);

    try {

      await prorrogarMaintenanceRecord(prorrogarId, novoPrazo);

      toast.success("Prazo prorrogado");

      setProrrogarId(null);

      setNovoPrazo("");

      load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao prorrogar prazo");

    } finally {

      setBaixandoId(null);

    }

  }

  async function executeDelete(id) {

    try {

      await deleteMaintenanceRecord(id);

      toast.success("Registro removido");

      load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao remover registro");

    }

  }

  function handleDelete(id) {

    setConfirmAction({
      message: "Remover este registro de manutenção? Esta ação não pode ser desfeita.",
      onConfirm: () => executeDelete(id),
    });

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
      "Mostrar encerradas/baixadas": showClosed ? "Sim" : "Não",
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

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <p className="mb-5 text-sm text-zinc-300">{confirmAction.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prorrogar modal inline */}
      {prorrogarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-2xl border border-zinc-700 bg-zinc-900 p-6">

            <h3 className="mb-4 text-base font-semibold">Prorrogar prazo</h3>

            <label className="mb-1 block text-sm text-zinc-400">
              Nova data de prazo
            </label>

            <input
              ref={dateInputRef}
              type="date"
              value={novoPrazo}
              onChange={(e) => setNovoPrazo(e.target.value)}
              className="
                mb-5 w-full rounded-xl border border-zinc-700
                bg-zinc-800 px-4 py-2.5 text-sm text-white
                focus:outline-none focus:ring-1 focus:ring-zinc-500
              "
            />

            <div className="flex gap-3">

              <button
                onClick={confirmProrrogar}
                disabled={baixandoId === prorrogarId}
                className="
                  flex-1 rounded-xl bg-white py-2.5
                  text-sm font-semibold text-black
                  transition hover:opacity-90
                  disabled:opacity-50
                "
              >
                Prorrogar
              </button>

              <button
                onClick={cancelProrrogar}
                className="
                  flex-1 rounded-xl border border-zinc-700
                  bg-zinc-950 py-2.5
                  text-sm font-semibold text-zinc-300
                  transition hover:bg-zinc-800
                "
              >
                Cancelar
              </button>

            </div>

          </div>
        </div>
      )}

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
            Mostrar encerradas/baixadas
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
                          <>

                            <button
                              onClick={() => openProrrogar(record.id)}
                              title="Prorrogar prazo"
                              className="
                                rounded-xl border border-zinc-700
                                bg-zinc-950 p-2
                                text-zinc-400 transition
                                hover:bg-yellow-500/15 hover:text-yellow-400
                              "
                            >
                              <CalendarClock size={14} />
                            </button>

                            <button
                              onClick={() => handleBaixar(record.id)}
                              disabled={baixandoId === record.id}
                              title="Dar baixa"
                              className="
                                rounded-xl border border-zinc-700
                                bg-zinc-950 p-2
                                text-zinc-400 transition
                                hover:bg-green-500/15 hover:text-green-400
                                disabled:opacity-50
                              "
                            >
                              <Archive size={14} />
                            </button>

                          </>
                        )}

                        {record.status === "BAIXADA" && (
                          <button
                            onClick={() => handleReativar(record.id)}
                            title="Reativar manutenção"
                            className="
                              rounded-xl border border-zinc-700
                              bg-zinc-950 p-2
                              text-zinc-400 transition
                              hover:bg-blue-500/15 hover:text-blue-400
                            "
                          >
                            <RotateCcw size={14} />
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
