import { useEffect, useRef, useState } from "react";
import { Download, Printer, RotateCcw } from "lucide-react";
import { getCompletedServiceOrders } from "../services/serviceOrderService";
import { getTechnicians } from "../services/technicianService";
import { FusionLogo } from "../assets/FusionLogo";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";

const SERVICE_TYPES = ["INSTALACAO", "TROCA", "MANUTENCAO"];

function fmt(v) {
  return v != null ? `R$ ${Number(v).toFixed(2)}` : "—";
}

export default function ServiceOrdersReports() {
  const [orders, setOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const printAreaRef = useRef(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [serviceType, setServiceType] = useState("");

  useEffect(() => {
    Promise.all([getCompletedServiceOrders(), getTechnicians()])
      .then(([os, techs]) => { setOrders(os); setTechnicians(techs); })
      .catch(() => toast.error("Erro ao carregar relatórios"))
      .finally(() => setLoading(false));
  }, []);

  function filtered() {
    return orders.filter(o => {
      const closed = o.closedAt ? new Date(o.closedAt) : null;
      if (dateFrom && closed && closed < new Date(dateFrom)) return false;
      if (dateTo && closed && closed > new Date(dateTo + "T23:59:59")) return false;
      if (technicianId && o.technician?.id !== technicianId) return false;
      if (serviceType && o.serviceType !== serviceType) return false;
      return true;
    });
  }

  function clearFilters() {
    setDateFrom(""); setDateTo(""); setTechnicianId(""); setServiceType("");
  }

  async function downloadXlsx() {
    const rows = filtered();
    const wb = new ExcelJS.Workbook();
    wb.creator = "Fusion";
    const ws = wb.addWorksheet("Ordens de Serviço");

    // Cabeçalho do relatório
    ws.mergeCells("A1:K1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `Fusion — Relatório de Ordens de Serviço — Gerado em ${new Date().toLocaleDateString("pt-BR")}`;
    titleCell.font = { bold: true, size: 13 };
    titleCell.alignment = { horizontal: "center" };
    ws.getRow(1).height = 24;

    ws.addRow([]);

    // Cabeçalhos das colunas
    const headerRow = ws.addRow([
      "Placa", "Encerrada", "Técnico", "Tipo", "SLA (dias)",
      "Serviço (R$)", "Deslocamento (R$)", "Total (R$)", "Sem Sinal", "Solicitante", "ID",
    ]);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } };
      cell.alignment = { horizontal: "center" };
    });
    ws.getRow(3).height = 18;

    // Dados
    rows.forEach(o => {
      ws.addRow([
        o.plate || "",
        o.closedAt ? new Date(o.closedAt).toLocaleDateString("pt-BR") : "",
        o.technician?.name || "",
        o.serviceType || "",
        o.slaDays,
        o.serviceValue != null ? Number(o.serviceValue) : "",
        o.displacementValue != null ? Number(o.displacementValue) : "",
        o.totalValue != null ? Number(o.totalValue) : "",
        o.completedWithoutSignal ? "Sim" : "Não",
        o.requestedBy || "",
        o.id,
      ]);
    });

    // Totais
    ws.addRow([]);
    const totalRow = ws.addRow([
      "TOTAL", "", "", "", "",
      rows.reduce((a, o) => a + (o.serviceValue ?? 0), 0),
      rows.reduce((a, o) => a + (o.displacementValue ?? 0), 0),
      rows.reduce((a, o) => a + (o.totalValue ?? 0), 0),
      "", "", "",
    ]);
    totalRow.eachCell((cell, col) => {
      if ([6, 7, 8].includes(col)) cell.font = { bold: true };
      if (col === 1) cell.font = { bold: true };
    });

    // Larguras das colunas
    [10, 14, 22, 14, 12, 16, 18, 14, 10, 18, 38].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    // Formato numérico para valores
    ws.eachRow((row, rn) => {
      if (rn <= 3) return;
      [6, 7, 8].forEach(col => {
        const cell = row.getCell(col);
        if (cell.value !== "") cell.numFmt = '"R$"#,##0.00';
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-os-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  const rows = filtered();
  const totalService = rows.reduce((a, o) => a + (o.serviceValue ?? 0), 0);
  const totalDisp    = rows.reduce((a, o) => a + (o.displacementValue ?? 0), 0);
  const totalVal     = rows.reduce((a, o) => a + (o.totalValue ?? 0), 0);
  const avgSla       = rows.length > 0 ? (rows.reduce((a, o) => a + o.slaDays, 0) / rows.length).toFixed(1) : "—";

  const INPUT = "rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none";

  return (
    <>
      {/* Print-only header (hidden on screen) */}
      <div className="hidden print:flex items-center gap-3 mb-6 pb-4 border-b border-gray-300">
        <FusionLogo size={40} />
        <div>
          <h1 className="text-xl font-bold">Fusion — Relatório de Ordens de Serviço</h1>
          <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
      </div>

      <div className="p-6 space-y-6 print:p-0">
        {/* Header */}
        <div className="print:hidden">
          <h1 className="text-2xl font-bold">Relatórios — Ordens de Serviço</h1>
          <p className="text-zinc-400 mt-1">Ordens concluídas com filtros avançados</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Data de início</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Data de fim</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Técnico</label>
            <select value={technicianId} onChange={e => setTechnicianId(e.target.value)} className={INPUT}>
              <option value="">Todos</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Tipo de Serviço</label>
            <select value={serviceType} onChange={e => setServiceType(e.target.value)} className={INPUT}>
              <option value="">Todos</option>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {(dateFrom || dateTo || technicianId || serviceType) && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900">
              <RotateCcw size={13} /> Limpar
            </button>
          )}
        </div>

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Ordens", rows.length],
              ["Valor Serviço", fmt(totalService)],
              ["Deslocamento", fmt(totalDisp)],
              ["Total Geral", fmt(totalVal)],
              ["SLA Médio", `${avgSla}d`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 print:border-gray-300 print:bg-white">
                <p className="text-xs text-zinc-500 uppercase tracking-wider print:text-gray-500">{label}</p>
                <p className="text-2xl font-bold mt-1 print:text-black">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {!loading && rows.length > 0 && (
          <div className="flex gap-3 print:hidden">
            <button onClick={downloadXlsx}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
              <Download size={14} /> Exportar Excel
            </button>
            <button onClick={printReport}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
              <Printer size={14} /> Imprimir / PDF
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-zinc-500">Carregando...</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 print:border-gray-300" ref={printAreaRef}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase print:text-gray-500 print:border-gray-300">
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Encerrada</th>
                  <th className="px-4 py-3">Técnico</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Serviço</th>
                  <th className="px-4 py-3">Deslocamento</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3 print:hidden">Sinal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 print:border-gray-200">
                    <td className="px-4 py-3 font-mono font-semibold">{o.plate || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400 print:text-gray-600">
                      {o.closedAt ? new Date(o.closedAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 print:text-gray-600">{o.technician?.name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400 print:text-gray-600">{o.serviceType}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold print:bg-transparent print:text-gray-600 ${o.late ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-400"}`}>
                        {o.slaDays}d{o.late ? " ⚠" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">{fmt(o.serviceValue)}</td>
                    <td className="px-4 py-3">{fmt(o.displacementValue)}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(o.totalValue)}</td>
                    <td className="px-4 py-3 print:hidden">
                      {o.completedWithoutSignal
                        ? <span className="text-xs text-yellow-400">⚠ Sem sinal</span>
                        : <span className="text-xs text-green-400">✓</span>
                      }
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                      Nenhuma OS concluída com os filtros aplicados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
