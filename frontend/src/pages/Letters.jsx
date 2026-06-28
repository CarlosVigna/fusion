import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { Download, Plus, Trash2 } from "lucide-react";

import {
  deleteLetter,
  getLetters,
} from "../services/letterService";

import {
  exportRowsToXlsx,
  todayForFilename,
} from "../utils/exportXlsx";

import LetterModal from "../components/letters/LetterModal";

import { formatLocalDate as formatDate } from "../utils/dateUtils";

function daysSince(value) {

  if (!value) {
    return null;
  }

  const diff = Date.now() - new Date(value).getTime();

  return Math.floor(diff / (1000 * 60 * 60 * 24));

}

function rowHighlight(letter) {

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

  const [modalLetter, setModalLetter] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);

  async function load() {

    setLoading(true);

    try {

      const data = await getLetters();

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

  }, []);

  function openCreate() {

    setModalLetter(null);

    setModalOpen(true);

  }

  function openEdit(letter) {

    setModalLetter(letter);

    setModalOpen(true);

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

  function handleExport() {

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
    ]);

    exportRowsToXlsx(
      `CARTAS_${todayForFilename()}.xlsx`,
      headers,
      rows
    );

  }

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-end gap-4">

        <div className="flex items-center gap-3">

          <button
            onClick={handleExport}
            className="
              flex items-center gap-2
              rounded-2xl border border-zinc-700
              bg-zinc-950 px-5 py-3
              text-sm font-semibold
              transition hover:bg-zinc-800
            "
          >
            <Download size={16} />
            Exportar
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

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="bg-zinc-950">
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
                <th className="px-4 py-4"></th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-10 text-center text-zinc-500">
                    Carregando...
                  </td>
                </tr>
              ) : letters.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-10 text-center text-zinc-500">
                    Nenhuma carta registrada
                  </td>
                </tr>
              ) : (
                letters.map((letter) => (
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
                    <td
                      className="px-4 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                    </td>
                  </tr>
                ))
              )}

            </tbody>

          </table>

        </div>

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
