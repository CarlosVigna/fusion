import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import toast from "react-hot-toast";

import {
  closeMaintenanceRecord,
  getOverdueMaintenanceRecords,
} from "../../../services/maintenanceService";

import { formatLocalDate } from "../../../utils/dateUtils";

export default function OverdueMaintenancePanel({ onChanged }) {

  const [records, setRecords] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [closingId, setClosingId] =
    useState(null);

  async function load() {

    setLoading(true);

    try {

      const data = await getOverdueMaintenanceRecords();

      setRecords(data);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar manutenções vencidas");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  async function handleClose(id) {

    if (!window.confirm("Finalizar esta manutenção?")) {
      return;
    }

    setClosingId(id);

    try {

      await closeMaintenanceRecord(id);

      toast.success("Manutenção finalizada");

      await load();

      onChanged?.();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao finalizar manutenção");

    } finally {

      setClosingId(null);

    }

  }

  if (loading) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Carregando...
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Nenhuma manutenção com prazo vencido
      </p>
    );
  }

  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-zinc-800">

      <table className="min-w-full">

        <thead className="sticky top-0 bg-zinc-950">
          <tr className="text-left text-sm text-zinc-400">
            <th className="px-4 py-3">Placa</th>
            <th className="px-4 py-3">Segurado</th>
            <th className="px-4 py-3">Local/Posição</th>
            <th className="px-4 py-3">Prazo</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>

        <tbody>

          {records.map((record) => (

            <tr
              key={record.id}
              className="border-t border-zinc-800 transition hover:bg-zinc-900"
            >

              <td className="px-4 py-3 font-mono font-semibold">
                <Link
                  to={`/vehicles/${record.plate}`}
                  className="transition hover:text-white"
                >
                  {record.plate}
                </Link>
              </td>

              <td className="px-4 py-3">
                {record.insuredName || "--"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {record.localPosicao || "--"}
              </td>

              <td className="px-4 py-3 text-red-400">
                {formatLocalDate(record.prazoEncerramento)}
              </td>

              <td className="px-4 py-3">
                <button
                  onClick={() => handleClose(record.id)}
                  disabled={closingId === record.id}
                  className="
                    rounded-xl bg-white px-4 py-2
                    text-xs font-semibold text-black
                    transition hover:opacity-90
                    disabled:opacity-50
                  "
                >
                  Finalizar
                </button>
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}
