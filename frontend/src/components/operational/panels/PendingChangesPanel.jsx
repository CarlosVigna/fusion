import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import {
  approveChange,
  getPendingChanges,
  rejectChange,
} from "../../../services/pendingChangeService";

import { formatLocalDateTime } from "../../../utils/dateUtils";

export default function PendingChangesPanel({ onChanged }) {

  const [changes, setChanges] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [resolvingId, setResolvingId] =
    useState(null);

  async function load() {

    setLoading(true);

    try {

      const data = await getPendingChanges();

      setChanges(data);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar mudanças pendentes");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  async function handleResolve(id, action) {

    setResolvingId(id);

    try {

      if (action === "approve") {
        await approveChange(id);
        toast.success("Mudança aprovada");
      } else {
        await rejectChange(id);
        toast.success("Mudança rejeitada");
      }

      setChanges((current) =>
        current.filter((change) => change.id !== id)
      );

      onChanged?.();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao resolver mudança");

    } finally {

      setResolvingId(null);

    }

  }

  if (loading) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Carregando...
      </p>
    );
  }

  if (changes.length === 0) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Nenhuma mudança pendente
      </p>
    );
  }

  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-zinc-800">

      <table className="min-w-full">

        <thead className="sticky top-0 bg-zinc-950">
          <tr className="text-left text-sm text-zinc-400">
            <th className="px-4 py-3">Placa</th>
            <th className="px-4 py-3">Campo</th>
            <th className="px-4 py-3">Valor antigo → novo</th>
            <th className="px-4 py-3">Detectado em</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>

        <tbody>

          {changes.map((change) => (

            <tr
              key={change.id}
              className="border-t border-zinc-800 transition hover:bg-zinc-900"
            >

              <td className="px-4 py-3 font-mono font-semibold">
                {change.vehiclePlate}
              </td>

              <td className="px-4 py-3">{change.fieldName}</td>

              <td className="px-4 py-3 text-sm">
                <span className="text-zinc-500">{change.oldValue}</span>
                {" → "}
                <span className="text-white">{change.newValue}</span>
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {formatLocalDateTime(change.detectedAt)}
              </td>

              <td className="px-4 py-3">
                <div className="flex gap-2">

                  <button
                    onClick={() => handleResolve(change.id, "approve")}
                    disabled={resolvingId === change.id}
                    className="
                      rounded-xl bg-green-500/15 px-3 py-1.5
                      text-xs font-semibold text-green-400
                      transition hover:bg-green-500/25
                      disabled:opacity-50
                    "
                  >
                    Aprovar
                  </button>

                  <button
                    onClick={() => handleResolve(change.id, "reject")}
                    disabled={resolvingId === change.id}
                    className="
                      rounded-xl bg-red-500/15 px-3 py-1.5
                      text-xs font-semibold text-red-400
                      transition hover:bg-red-500/25
                      disabled:opacity-50
                    "
                  >
                    Rejeitar
                  </button>

                </div>
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}
