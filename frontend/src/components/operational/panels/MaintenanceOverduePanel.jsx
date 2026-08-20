import { useEffect, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import {
  closeMaintenanceRecord,
  getOverdueMaintenanceRecords,
} from "../../../services/maintenanceService";

import { formatLocalDate } from "../../../utils/dateUtils";

// prazoEncerramento vem como data pura (yyyy-MM-dd) — calcula em dias de
// calendário, sem conversão de fuso, igual ao daysUntil() de Maintenance.jsx.
function daysOverdue(dateStr) {

  if (!dateStr) {
    return null;
  }

  const [y, m, d] = dateStr.split("-").map(Number);
  const prazo = new Date(y, m - 1, d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = today.getTime() - prazo.getTime();

  return Math.floor(diff / (1000 * 60 * 60 * 24));

}

export default function MaintenanceOverduePanel({ onChanged }) {

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] = useState(null);

  const [confirmId, setConfirmId] = useState(null);

  const navigate = useNavigate();

  async function load() {

    setLoading(true);

    try {

      const data = await getOverdueMaintenanceRecords();

      setRecords(Array.isArray(data) ? data : []);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar manutenções com prazo vencido");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  async function executeClose(id) {

    setProcessingId(id);

    try {

      await closeMaintenanceRecord(id);

      toast.success("Manutenção encerrada");

      await load();

      onChanged?.();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dar baixa na manutenção");

    } finally {

      setProcessingId(null);

    }

  }

  return (
    <div className="rounded-2xl border border-red-500/30 bg-zinc-900 p-6">

      <h2 className="mb-4 text-base font-semibold text-red-400">
        ⚠️ Prazos Vencidos ({records.length})
      </h2>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <p className="mb-5 text-sm text-zinc-300">
              Dar baixa nesta manutenção? Esta ação pode ser desfeita usando o botão Reativar.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { executeClose(confirmId); setConfirmId(null); }}
                className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-zinc-500">Carregando...</p>
      ) : records.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">Nenhuma manutenção com prazo vencido</p>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-zinc-900">
              <tr className="text-left text-zinc-500">
                <th className="px-3 py-2">Placa</th>
                <th className="px-3 py-2">Segurado</th>
                <th className="px-3 py-2">Modelo</th>
                <th className="px-3 py-2">Prazo</th>
                <th className="px-3 py-2">Dias em atraso</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => navigate("/maintenance")}
                  className="cursor-pointer border-t border-zinc-800 transition hover:bg-zinc-800/60"
                >
                  <td className="px-3 py-2 font-mono font-semibold">
                    <Link
                      to={`/vehicles/${record.plate}`}
                      onClick={(e) => e.stopPropagation()}
                      className="transition hover:text-white"
                    >
                      {record.plate}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{record.insuredName || "--"}</td>
                  <td className="px-3 py-2 text-zinc-400">{record.modelo || "--"}</td>
                  <td className="px-3 py-2 text-zinc-400">{formatLocalDate(record.prazoEncerramento)}</td>
                  <td className="px-3 py-2 font-semibold text-red-400">
                    {daysOverdue(record.prazoEncerramento) ?? "--"}d
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setConfirmId(record.id)}
                      disabled={processingId === record.id}
                      className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                    >
                      ✅ Dar Baixa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
