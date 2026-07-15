import { useState } from "react";

import toast from "react-hot-toast";

import { FileSpreadsheet } from "lucide-react";

import { getMultiportalSheet } from "../services/reportsService";

import { todayForFilename } from "../utils/exportXlsx";

const BLACK = "FF000000";
const HEADER_FILL = "FF18181B";
const RED_FILL = "FFFCA5A5";
const YELLOW_FILL = "FFFDE68A";

const SNAPSHOT_KEY = "fusion_multiportal_snapshot";

const BLOCK_ORDER = ["operational", "kako", "tests", "verification"];

const BLOCK_LABELS = {
  operational: "Operacionais",
  kako: "KAKO",
  tests: "Testes",
  verification: "Verificação",
};

const FIELD_LABELS = {
  numberStr: "dispositivo",
  status: "status",
  insuredName: "segurado",
  policyNumber: "apólice",
  policyEndDate: "fim de vigência",
  cpfCnpj: "CPF/CNPJ",
};

// Campos comparados no diff — data/hora de comunicação ficam de fora de
// propósito (mudam toda hora e gerariam ruído em praticamente todo diff).
const DIFF_FIELDS = [
  "policyNumber",
  "insuredName",
  "cpfCnpj",
  "policyEndDate",
  "numberStr",
  "status",
];

const COLUMNS = [
  { header: "Ordem", width: 8 },
  { header: "Placa", width: 14 },
  { header: "Dispositivo", width: 16 },
  { header: "Posição", width: 12 },
  { header: "Hora", width: 10 },
  { header: "Status", width: 40 },
  { header: "Nome Segurado", width: 32 },
  { header: "Apólice", width: 18 },
  { header: "Fim Vigência", width: 14 },
  { header: "CPF/CNPJ", width: 18 },
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

async function buildWorkbook(blocks) {
  const { default: ExcelJS } = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fusion";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("MULTIPORTAL");

  const lastCol = COLUMNS.length;

  for (const blockKey of BLOCK_ORDER) {
    addBlock(sheet, lastCol, blockKey, blocks[blockKey] ?? []);
  }

  COLUMNS.forEach((col, index) => {
    sheet.getColumn(index + 1).width = col.width;
  });

  return workbook;
}

function addBlock(sheet, lastCol, blockKey, rows) {
  const title = BLOCK_LABELS[blockKey] ?? blockKey;
  const isVerification = blockKey === "verification";

  const separatorRow = sheet.addRow([`${title} — ${rows.length} veículo(s)`]);
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

  rows.forEach((row, index) => {
    const excelRow = sheet.addRow([
      index + 1,
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
  });

  const totalRow = sheet.addRow([`Total: ${rows.length} veículo(s)`]);
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

function loadSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

// Snapshot comparavel entre gerações — sem data/hora de comunicação de
// propósito, ver comentário em DIFF_FIELDS.
function buildSnapshot(blocks) {
  const snapshot = {};

  for (const blockKey of BLOCK_ORDER) {
    for (const row of blocks[blockKey] ?? []) {
      snapshot[row.plate] = {
        numberStr: row.numberStr,
        status: row.status,
        insuredName: row.insuredName,
        policyNumber: row.policyNumber,
        policyEndDate: row.policyEndDate,
        cpfCnpj: row.cpfCnpj,
        block: row.block,
      };
    }
  }

  return snapshot;
}

function diffSnapshots(oldSnapshot, newSnapshot) {
  const messages = [];

  // Primeira geração (sem snapshot salvo) — nada a comparar.
  if (!oldSnapshot) return messages;

  const oldPlates = Object.keys(oldSnapshot);
  const newPlates = Object.keys(newSnapshot);

  for (const plate of newPlates) {
    if (!oldSnapshot[plate]) {
      messages.push(`Placa ${plate}: nova placa no sistema`);
    }
  }

  for (const plate of oldPlates) {
    if (!newSnapshot[plate]) {
      messages.push(`Placa ${plate}: saiu do sistema`);
    }
  }

  for (const plate of newPlates) {
    const before = oldSnapshot[plate];
    const after = newSnapshot[plate];

    if (!before) continue;

    if (before.block !== after.block) {
      const fromLabel = BLOCK_LABELS[before.block] ?? before.block;
      const toLabel = BLOCK_LABELS[after.block] ?? after.block;
      messages.push(`Placa ${plate} mudou de bloco: ${fromLabel} → ${toLabel}`);
    }

    for (const field of DIFF_FIELDS) {
      const beforeValue = before[field] ?? "";
      const afterValue = after[field] ?? "";

      if (beforeValue !== afterValue) {
        messages.push(
          `Placa ${plate}: ${FIELD_LABELS[field]} mudou de "${beforeValue || "vazio"}" para "${afterValue || "vazio"}"`
        );
      }
    }
  }

  return messages;
}

function ChangesModal({ changes, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-lg font-semibold">Mudanças desde a última planilha</h3>
        <p className="mt-1 text-sm text-zinc-500">
          {changes.length} mudança(s) detectada(s) em relação à última planilha gerada neste navegador.
        </p>

        <ul className="mt-4 flex-1 space-y-2 overflow-y-auto text-sm text-zinc-300">
          {changes.map((message, index) => (
            <li key={index} className="rounded-lg bg-zinc-950 px-3 py-2">
              {message}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState(null);

  async function finalizeGeneration(blocks, snapshot) {
    const workbook = await buildWorkbook(blocks);

    await downloadWorkbook(
      workbook,
      `planilha-multiportal-${todayForFilename()}.xlsx`
    );

    saveSnapshot(snapshot);

    setSummary({
      operational: blocks.operational.length,
      kako: blocks.kako.length,
      tests: blocks.tests.length,
      verification: blocks.verification.length,
    });

    toast.success("Planilha MULTIPORTAL gerada com sucesso");

    setLoading(false);
  }

  async function handleGenerate() {
    setLoading(true);
    setSummary(null);

    try {
      const data = await getMultiportalSheet();
      const newSnapshot = buildSnapshot(data.blocks);
      const oldSnapshot = loadSnapshot();
      const changes = diffSnapshots(oldSnapshot, newSnapshot);

      if (changes.length > 0) {
        setPending({ blocks: data.blocks, snapshot: newSnapshot, changes });
        setLoading(false);
        return;
      }

      await finalizeGeneration(data.blocks, newSnapshot);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar planilha: " + error.message);
      setLoading(false);
    }
  }

  async function handleConfirmChanges() {
    if (!pending) return;

    const { blocks, snapshot } = pending;

    setPending(null);
    setLoading(true);

    try {
      await finalizeGeneration(blocks, snapshot);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar planilha: " + error.message);
      setLoading(false);
    }
  }

  function handleCancelChanges() {
    setPending(null);
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

      {pending && (
        <ChangesModal
          changes={pending.changes}
          onConfirm={handleConfirmChanges}
          onCancel={handleCancelChanges}
        />
      )}

    </div>
  );
}
