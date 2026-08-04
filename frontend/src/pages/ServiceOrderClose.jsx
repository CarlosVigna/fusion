import { useState } from "react";
import { Download } from "lucide-react";
import { getMonthlyClose } from "../services/serviceOrderService";
import toast from "react-hot-toast";

function fmt(v) { return v != null ? `R$ ${Number(v).toFixed(2)}` : "—"; }

export default function ServiceOrderClose() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await getMonthlyClose(month));
    } catch {
      toast.error("Erro ao carregar fechamento");
    } finally {
      setLoading(false);
    }
  }

  function downloadExcel() {
    window.open(`/api/service-orders/monthly-close/excel?month=${month}`, "_blank");
  }
  function downloadPdf() {
    window.open(`/api/service-orders/monthly-close/pdf?month=${month}`, "_blank");
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fechamento Mensal</h1>
        <p className="text-zinc-400 mt-1">Ordens concluídas por período</p>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Mês</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? "Carregando..." : "Gerar"}
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Ordens", data.count],
              ["Valor Serviço", fmt(data.totalServiceValue)],
              ["Deslocamento", fmt(data.totalDisplacementValue)],
              ["Total Geral", fmt(data.totalValue)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={downloadExcel} className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
              <Download size={14} /> Baixar CSV
            </button>
            <button onClick={downloadPdf} className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
              <Download size={14} /> Baixar HTML/PDF
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase">
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">Técnico</th>
                  <th className="px-4 py-3">Encerrada</th>
                  <th className="px-4 py-3">Serviço</th>
                  <th className="px-4 py-3">Deslocamento</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="px-4 py-3 font-mono font-semibold">{o.plate}</td>
                    <td className="px-4 py-3 text-zinc-400">{o.requestedBy || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{o.technician?.name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{o.closedAt ? new Date(o.closedAt).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3">{fmt(o.serviceValue)}</td>
                    <td className="px-4 py-3">{fmt(o.displacementValue)}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(o.totalValue)}</td>
                  </tr>
                ))}
                {data.orders.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhuma OS concluída neste período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
