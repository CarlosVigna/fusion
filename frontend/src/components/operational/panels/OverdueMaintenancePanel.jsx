import { useEffect, useRef, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import {
  baixarMaintenanceRecord,
  getOverdueMaintenanceRecords,
  prorrogarMaintenanceRecord,
} from "../../../services/maintenanceService";

import { formatLocalDate } from "../../../utils/dateUtils";

export default function OverdueMaintenancePanel({ onChanged }) {

  const [records, setRecords] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [processingId, setProcessingId] =
    useState(null);

  const [prorrogarId, setProrrogarId] =
    useState(null);

  const [novoPrazo, setNovoPrazo] =
    useState("");

  const [confirmAction, setConfirmAction] =
    useState(null);

  const dateInputRef = useRef(null);

  const navigate = useNavigate();

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

  async function executeBaixar(id) {

    setProcessingId(id);

    try {

      await baixarMaintenanceRecord(id);

      toast.success("Manutenção baixada");

      await load();

      onChanged?.();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dar baixa na manutenção");

    } finally {

      setProcessingId(null);

    }

  }

  function handleBaixar(id) {

    setConfirmAction({
      message: "Dar baixa nesta manutenção? Esta ação pode ser desfeita usando o botão Reativar.",
      onConfirm: () => executeBaixar(id),
    });

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

    setProcessingId(prorrogarId);

    try {

      await prorrogarMaintenanceRecord(prorrogarId, novoPrazo);

      toast.success("Prazo prorrogado");

      setProrrogarId(null);

      setNovoPrazo("");

      await load();

      onChanged?.();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao prorrogar prazo");

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

  if (records.length === 0) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Nenhuma manutenção com prazo vencido
      </p>
    );
  }

  return (
    <>

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
              onClick={() => navigate("/maintenance")}
              className="cursor-pointer border-t border-zinc-800 transition hover:bg-zinc-900"
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

              <td
                className="px-4 py-3"
                onClick={(e) => e.stopPropagation()}
              >

                {prorrogarId === record.id ? (

                  <div className="flex items-center gap-2">

                    <input
                      ref={dateInputRef}
                      type="date"
                      value={novoPrazo}
                      onChange={(e) => setNovoPrazo(e.target.value)}
                      className="
                        rounded-xl border border-zinc-700
                        bg-zinc-900 px-3 py-1.5
                        text-xs text-white
                        focus:outline-none focus:ring-1 focus:ring-zinc-500
                      "
                    />

                    <button
                      onClick={confirmProrrogar}
                      disabled={processingId === record.id}
                      className="
                        rounded-xl bg-white px-3 py-1.5
                        text-xs font-semibold text-black
                        transition hover:opacity-90
                        disabled:opacity-50
                      "
                    >
                      OK
                    </button>

                    <button
                      onClick={cancelProrrogar}
                      className="
                        rounded-xl border border-zinc-700
                        bg-zinc-950 px-3 py-1.5
                        text-xs text-zinc-400
                        transition hover:bg-zinc-800
                      "
                    >
                      ×
                    </button>

                  </div>

                ) : (

                  <div className="flex gap-2">

                    <button
                      onClick={() => openProrrogar(record.id)}
                      disabled={processingId === record.id}
                      className="
                        rounded-xl border border-zinc-700
                        bg-zinc-950 px-3 py-1.5
                        text-xs font-semibold text-zinc-300
                        transition hover:bg-zinc-800
                        disabled:opacity-50
                      "
                    >
                      Prorrogar
                    </button>

                    <button
                      onClick={() => handleBaixar(record.id)}
                      disabled={processingId === record.id}
                      className="
                        rounded-xl bg-white px-3 py-1.5
                        text-xs font-semibold text-black
                        transition hover:opacity-90
                        disabled:opacity-50
                      "
                    >
                      Baixar
                    </button>

                  </div>

                )}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

    </>
  );
}
