import { useState } from "react";

import toast from "react-hot-toast";

import { FileSpreadsheet } from "lucide-react";

import { getMultiportalSheet } from "../services/reportsService";

import { todayForFilename } from "../utils/exportXlsx";

const BLACK = "FF000000";
const HEADER_FILL = "FF18181B";
const RED_FILL = "FFFCA5A5";
const YELLOW_FILL = "FFFDE68A";

const COLUMNS = [
  { key: "ordem", header: "Ordem", width: 8 },
  { key: "plate", header: "Placa", width: 14 },
  { key: "numberStr", header: "Dispositivo", width: 16 },
  { key: "lastCommunicationDate", header: "Posição", width: 12 },
  { key: "lastCommunicationTime", header: "Hora", width: 10 },
  { key: "status", header: "Status", width: 40 },
  { key: "insuredName", header: "Nome Segurado", width: 32 },
  { key: "policyNumber", header: "Apólice", width: 18 },
  { key: "policyEndDate", header: "Fim Vigência", width: 14 },
  { key: "cpfCnpj", header: "CPF/CNPJ", width: 18 },
];

function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(isoTime) {
  if (!isoTime) return "";
  return isoTime.slice(0, 5);
}

function rowStatusFill(status) {
  if (!status) return null;
  if (status.includes("#CARTASUSPENSAO")) return RED_FILL;
  if (status.includes("#MANUTENCAO")) return YELLOW_FILL;
  return null;
}

function verificationFill(row) {
  if (!row.lastCommunicationDate) return RED_FILL;
  if (!row.policyNumber) return YELLOW_FILL;
  return null;
}

async function buildWorkbook(data) {
  const { default: ExcelJS } = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fusion";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("MULTIPORTAL");

  const lastCol = COLUMNS.length;

  const blocks = [
    { title: "OPERACIONAIS", block: data.operational, isVerification: false },
    { title: "KAKO", block: data.kako, isVerification: false },
    { title: "TESTES", block: data.tests, isVerification: false },
    { title: "VERIFICAÇÃO", block: data.verification, isVerification: true },
  ];

  for (const { title, block, isVerification } of blocks) {
    addBlock(sheet, lastCol, title, block, isVerification);
  }

  COLUMNS.forEach((col, index) => {
    sheet.getColumn(index + 1).width = col.width;
  });

  return workbook;
}

function addBlock(sheet, lastCol, title, block, isVerification) {
  const separatorRow = sheet.addRow([`${title} — ${block.total} veículo(s)`]);
  sheet.mergeCells(separatorRow.number, 1, separatorRow.number, lastCol);
  separatorRow.height = 22;

  const separatorCell = separatorRow.getCell(1);
  separatorCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  separatorCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
  separatorCell.alignment = { vertical: "middle", horizontal: "left" };

  const headerRow = sheet.addRow(COLUMNS.map((col) => col.header));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
  });

  for (const row of block.rows) {
    const excelRow = sheet.addRow([
      row.ordem,
      row.plate,
      row.numberStr ?? "",
      formatDate(row.lastCommunicationDate),
      formatTime(row.lastCommunicationTime),
      row.status ?? "",
      row.insuredName ?? "",
      row.policyNumber ?? "",
      formatDate(row.policyEndDate),
      row.cpfCnpj ?? "",
    ]);

    const fill = isVerification ? verificationFill(row) : rowStatusFill(row.status);

    if (fill) {
      excelRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      });
    }
  }

  const totalRow = sheet.addRow([`Total: ${block.total} veículo(s)`]);
  sheet.mergeCells(totalRow.number, 1, totalRow.number, lastCol);
  totalRow.getCell(1).font = { bold: true };

  sheet.addRow([]);
}

function downloadWorkbook(workbook, filename) {
  return workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  async function handleGenerate() {
    setLoading(true);
    setSummary(null);

    try {
      const data = await getMultiportalSheet();
      const workbook = await buildWorkbook(data);

      await downloadWorkbook(
        workbook,
        `planilha-multiportal-${todayForFilename()}.xlsx`
      );

      setSummary({
        operational: data.operational.total,
        kako: data.kako.total,
        tests: data.tests.total,
        verification: data.verification.total,
      });

      toast.success("Planilha MULTIPORTAL gerada com sucesso");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar planilha: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Card principal */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

        <div className="border-b border-zinc-800 p-6">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-zinc-400" />
            <div>
              <h2 className="text-lg font-semibold">Planilha MULTIPORTAL</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Gera e baixa automaticamente a planilha com os dados atuais
                do banco — separada em blocos de Operacionais, KAKO, Testes
                e Verificação.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="
              w-full rounded-xl bg-white py-3
              text-sm font-semibold text-black
              transition hover:bg-zinc-200
              disabled:cursor-not-allowed disabled:opacity-40
            "
          >
            {loading ? "Gerando..." : "Gerar e Baixar Planilha MULTIPORTAL"}
          </button>
        </div>

      </div>

      {/* Resumo */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
            <p className="text-3xl font-bold text-white">{summary.operational}</p>
            <p className="mt-1 text-sm text-zinc-400">Operacionais</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
            <p className="text-3xl font-bold text-white">{summary.kako}</p>
            <p className="mt-1 text-sm text-zinc-400">KAKO</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
            <p className="text-3xl font-bold text-white">{summary.tests}</p>
            <p className="mt-1 text-sm text-zinc-400">Testes</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
            <p className="text-3xl font-bold text-orange-400">{summary.verification}</p>
            <p className="mt-1 text-sm text-zinc-400">Verificação</p>
          </div>
        </div>
      )}

    </div>
  );
}
