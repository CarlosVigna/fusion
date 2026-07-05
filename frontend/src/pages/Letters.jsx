import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { Archive, FileSpreadsheet, FileText, Plus, Trash2 } from "lucide-react";

import {
  baixarLetter,
  deleteLetter,
  getLetters,
} from "../services/letterService";

import {
  todayForFilename,
} from "../utils/exportXlsx";

import LetterModal from "../components/letters/LetterModal";

import Pagination from "../components/ui/Pagination";

import { usePagination } from "../hooks/usePagination";

import { formatLocalDate as formatDate } from "../utils/dateUtils";

import { realtimeService } from "../services/realtime/realtimeService";

function daysSince(value) {

  if (!value) {
    return null;
  }

  const diff = Date.now() - new Date(value).getTime();

  return Math.floor(diff / (1000 * 60 * 60 * 24));

}

function rowHighlight(letter) {

  if (letter.status === "BAIXADA") {
    return "opacity-50";
  }

  if (letter.dataRetornoSinal !== "Sem retorno.") {
    return "";
  }

  const days = daysSince(letter.dataEnvio);

  if (days == null) {
    return "";
  }

  if (days > 60) {
    return "bg-red-500/10 hover:bg-red-500/15";
  }

  if (days > 30) {
    return "bg-yellow-500/10 hover:bg-yellow-500/15";
  }

  return "";

}

export default function Letters() {

  const [letters, setLetters] = useState([]);

  const [loading, setLoading] = useState(true);

  const [showArchived, setShowArchived] = useState(false);

  const [modalLetter, setModalLetter] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);

  const [baixandoId, setBaixandoId] = useState(null);

  const {
    page,
    setPage,
    totalPages,
    pageItems,
    pageSize,
    totalItems,
  } = usePagination(letters);

  async function load() {

    setLoading(true);

    try {

      const data = await getLetters(showArchived);

      setLetters(data);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar cartas de suspensão");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, [showArchived]);

  useEffect(() => {

    const unsubscribe = realtimeService.onDashboardEvent((event) => {

      if (event?.type === "GRID_UPDATED") {

        load();

      }

    });

    return () => unsubscribe();

  }, [showArchived]);

  function openCreate() {

    setModalLetter(null);

    setModalOpen(true);

  }

  function openEdit(letter) {

    setModalLetter(letter);

    setModalOpen(true);

  }

  async function handleBaixar(id) {

    if (!window.confirm("Dar baixa nesta carta de suspensão?")) {
      return;
    }

    setBaixandoId(id);

    try {

      await baixarLetter(id);

      toast.success("Baixa dada na carta");

      load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dar baixa na carta");

    } finally {

      setBaixandoId(null);

    }

  }

  async function handleDelete(id) {

    if (!window.confirm("Remover esta carta de suspensão?")) {
      return;
    }

    try {

      await deleteLetter(id);

      toast.success("Carta removida");

      load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao remover carta");

    }

  }

  function buildExportData() {

    const headers = [
      "PLACA",
      "SEGURADO",
      "BASE",
      "MODELO",
      "ULTIMA POSIÇÃO",
      "DATA DO ENVIO",
      "FIM DA VIGÊNCIA",
      "OS ABERTA",
      "DATA DO RETORNO DE SINAL",
      "OPERADOR",
      "STATUS",
    ];

    const rows = letters.map((letter) => [
      letter.plate,
      letter.insuredName || "",
      letter.base || "",
      letter.modelo || "",
      formatDate(letter.ultimaPosicao),
      formatDate(letter.dataEnvio),
      formatDate(letter.fimVigencia),
      letter.osAberta || "",
      letter.dataRetornoSinal || "",
      letter.operador || "",
      letter.status || "",
    ]);

    return { headers, rows };

  }

  async function handleExportExcel() {

    const { headers, rows } = buildExportData();

    const { exportReportToExcel } = await import("../utils/reportExport");

    exportReportToExcel({
      title: "Cartas de Suspensão",
      headers,
      rows,
      filters: { "Mostrar baixadas": showArchived ? "Sim" : "Não" },
      filename: `CARTAS_${todayForFilename()}.xlsx`,
    });

  }

  async function handleExportPdf() {

    const { headers, rows } = buildExportData();

    const { exportReportToPdf } = await import("../utils/reportExport");

    exportReportToPdf({
      title: "Cartas de Suspensão",
      headers,
      rows,
      filters: { "Mostrar baixadas": showArchived ? "Sim" : "Não" },
      filename: `CARTAS_${todayForFilename()}.pdf`,
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
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-zinc-700"
            />
            Ver baixadas
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
            Nova Carta
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
                <th className="px-4 py-4">Placa</th>
                <th className="px-4 py-4">Segurado</th>
                <th className="px-4 py-4">Base</th>
                <th className="px-4 py-4">Modelo</th>
                <th className="px-4 py-4">Última posição</th>
                <th className="px-4 py-4">Data do envio</th>
                <th className="px-4 py-4">Fim da vigência</th>
                <th className="px-4 py-4">OS aberta</th>
                <th className="px-4 py-4">Retorno de sinal</th>
                <th className="px-4 py-4">Operador</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center text-zinc-500">
                    Carregando...
                  </td>
                </tr>
              ) : letters.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center text-zinc-500">
                    Nenhuma carta registrada
                  </td>
                </tr>
              ) : (
                pageItems.map((letter) => (
                  <tr
                    key={letter.id}
                    onClick={() => openEdit(letter)}
                    className={`
                      cursor-pointer border-t border-zinc-800
                      transition
                      ${rowHighlight(letter)}
                    `}
                  >
                    <td className="px-4 py-4 font-mono font-semibold">
                      {letter.plate}
                    </td>
                    <td className="px-4 py-4">{letter.insuredName || "--"}</td>
                    <td className="px-4 py-4">{letter.base || "--"}</td>
                    <td className="px-4 py-4">{letter.modelo || "--"}</td>
                    <td className="px-4 py-4 text-zinc-400">
                      {formatDate(letter.ultimaPosicao)}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {formatDate(letter.dataEnvio)}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {formatDate(letter.fimVigencia)}
                    </td>
                    <td className="px-4 py-4">{letter.osAberta || "--"}</td>
                    <td className="px-4 py-4 text-zinc-400">
                      {letter.dataRetornoSinal || "--"}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {letter.operador || "--"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`
                          rounded-full px-3 py-1 text-xs font-semibold
                          ${letter.status === "ATIVA"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-zinc-700/40 text-zinc-400"}
                        `}
                      >
                        {letter.status || "ATIVA"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-2">

                        {letter.status !== "BAIXADA" && (
                          <button
                            onClick={() => handleBaixar(letter.id)}
                            disabled={baixandoId === letter.id}
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
                        )}

                        <button
                          onClick={() => handleDelete(letter.id)}
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
        <LetterModal
          letter={modalLetter}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}

    </div>
  );
}
