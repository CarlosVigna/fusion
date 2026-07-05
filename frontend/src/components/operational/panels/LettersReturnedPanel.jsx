import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import toast from "react-hot-toast";

import {
  baixarLetter,
  getLettersPendingBaixa,
} from "../../../services/letterService";

import { formatLocalDate } from "../../../utils/dateUtils";

export default function LettersReturnedPanel({ onChanged }) {

  const [letters, setLetters] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [processingId, setProcessingId] =
    useState(null);

  async function load() {

    setLoading(true);

    try {

      const data = await getLettersPendingBaixa();

      setLetters(data);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar cartas pendentes de baixa");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  async function handleBaixa(id) {

    setProcessingId(id);

    try {

      await baixarLetter(id);

      toast.success("Baixa dada na carta");

      await load();

      onChanged?.();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dar baixa");

    } finally {

      setProcessingId(null);

    }

  }

  if (loading) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Carregando...
      </p>
    );
  }

  if (letters.length === 0) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Nenhuma carta com sinal retornado pendente de baixa
      </p>
    );
  }

  return (
    <div className="max-h-[28rem] space-y-3 overflow-y-auto">

      {letters.map((letter) => (

        <div
          key={letter.id}
          className="
            rounded-2xl border border-zinc-800
            bg-zinc-900 p-4
          "
        >

          <div className="flex flex-wrap items-start justify-between gap-3">

            <div>

              <p className="font-mono font-semibold">
                🟢{" "}
                <Link
                  to={`/vehicles/${letter.plate}`}
                  className="transition hover:text-white"
                >
                  {letter.plate}
                </Link>
                {letter.insuredName && ` — ${letter.insuredName}`}
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                Sinal ativo — carta enviada em{" "}
                {formatLocalDate(letter.dataEnvio)}
                {letter.modelo && ` · ${letter.modelo}`}
              </p>

              {letter.base && (
                <p className="mt-1 text-xs text-zinc-500">
                  Base: {letter.base}
                  {letter.operador && ` · Operador: ${letter.operador}`}
                </p>
              )}

            </div>

            <button
              onClick={() => handleBaixa(letter.id)}
              disabled={processingId === letter.id}
              className="
                rounded-xl bg-white px-4 py-2
                text-xs font-semibold text-black
                transition hover:opacity-90
                disabled:opacity-50
              "
            >
              Dar baixa
            </button>

          </div>

        </div>

      ))}

    </div>
  );
}
