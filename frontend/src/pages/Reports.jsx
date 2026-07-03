import { useRef, useState } from "react";

import toast from "react-hot-toast";

import { FileSpreadsheet, Upload, X } from "lucide-react";

import { getOperationalGrid } from "../services/gridService";

// Normaliza placa para comparação (remove traço, espaços, uppercase)
function normalizePlate(raw) {
  if (!raw) return "";
  return String(raw).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

// Converte LocalDateTime UTC do backend para data/hora no horário de Brasília
function toLocaleBrasilia(isoString) {
  if (!isoString) return { date: "", time: "" };
  // Backend serializa LocalDateTime sem fuso → interpretar como UTC
  const dt = new Date(isoString + "Z");
  const date = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const time = dt.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return { date, time };
}

export default function Reports() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Form de adição manual de veículos ausentes da planilha
  const [addForm, setAddForm] = useState({ plate: "", name: "" });

  // Referência ao workbook ExcelJS processado, para permitir re-download
  // após o usuário adicionar linhas manualmente.
  const workbookRef = useRef(null);

  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      workbookRef.current = null;
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.name.endsWith(".xlsx")) {
      setFile(dropped);
      setResult(null);
      workbookRef.current = null;
    }
  }

  async function handleGenerate() {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      // Carrega ExcelJS dinamicamente (evita bundle main)
      const { default: ExcelJS } = await import("exceljs");

      // Lê o xlsx como ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // Busca dados do grid no backend (sem filtros = todos os veículos)
      const gridVehicles = await getOperationalGrid();

      // Índice por placa normalizada
      const gridMap = {};
      for (const v of gridVehicles) {
        gridMap[normalizePlate(v.plate)] = v;
      }

      const worksheet = workbook.worksheets[0];

      // Descobre a linha de cabeçalho procurando "Placa" na col A
      let headerRowNum = -1;
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (headerRowNum !== -1) return;
        const cellValue = row.getCell(1).text ?? row.getCell(1).value;
        if (String(cellValue ?? "").trim().toLowerCase() === "placa") {
          headerRowNum = rowNumber;
        }
      });

      if (headerRowNum === -1) {
        toast.error("Cabeçalho 'Placa' não encontrado na planilha.");
        setLoading(false);
        return;
      }

      const updated = [];
      const notInGrid = []; // Na planilha mas não no sistema
      const sheetsPlates = new Set();

      for (let rowNum = headerRowNum + 1; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rawPlate = row.getCell(1).text ?? String(row.getCell(1).value ?? "");
        const plate = normalizePlate(rawPlate);

        if (!plate) continue;

        sheetsPlates.add(plate);

        const vehicle = gridMap[plate];

        if (!vehicle) {
          notInGrid.push(rawPlate.trim());
          continue;
        }

        if (vehicle.lastCommunicationAt) {
          const { date, time } = toLocaleBrasilia(vehicle.lastCommunicationAt);

          // Atualiza apenas o valor — o estilo da célula original é preservado
          // pelo ExcelJS ao ler e reescrever o workbook.
          row.getCell(4).value = date; // col D = data
          row.getCell(5).value = time; // col E = hora

          updated.push(plate);
        }
      }

      // Placas no sistema mas ausentes da planilha
      const notInSheet = gridVehicles
        .map((v) => v.plate)
        .filter((p) => !sheetsPlates.has(normalizePlate(p)));

      workbookRef.current = workbook;

      // Dispara o download imediatamente
      await downloadWorkbook(workbook, file.name);

      setResult({ updated, notInGrid, notInSheet });

      toast.success(`${updated.length} veículos atualizados`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar planilha: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadWorkbook(workbook, originalName) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = originalName || "CONTROLE_DE_VEÍCULOS_MULTIPORTAL.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAddToSheet() {
    if (!workbookRef.current) return;

    const plate = normalizePlate(addForm.plate);
    const name = addForm.name.trim();

    if (!plate) {
      toast.error("Informe a placa");
      return;
    }

    const worksheet = workbookRef.current.worksheets[0];

    // Adiciona uma nova linha ao final com placa e nome
    const newRow = worksheet.addRow([plate, "", "", "", "", "", "", "", "", "", "", name]);
    newRow.commit();

    await downloadWorkbook(workbookRef.current, file?.name);

    setAddForm({ plate: "", name: "" });

    // Remove do notInSheet se estava lá
    setResult((prev) =>
      prev
        ? {
            ...prev,
            notInSheet: prev.notInSheet.filter(
              (p) => normalizePlate(p) !== plate
            ),
          }
        : prev
    );

    toast.success(`Veículo ${plate} adicionado à planilha`);
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
                Atualiza data e hora de posicionamento (colunas D e E) para
                cada placa encontrada no Grid.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="
              flex cursor-pointer flex-col items-center justify-center
              gap-3 rounded-xl border-2 border-dashed border-zinc-700
              bg-zinc-950 px-6 py-10
              transition hover:border-zinc-500 hover:bg-zinc-900
            "
          >
            <Upload size={28} className="text-zinc-500" />
            {file ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-white">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setResult(null);
                    workbookRef.current = null;
                    fileInputRef.current.value = "";
                  }}
                  className="rounded p-0.5 text-zinc-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-zinc-400">
                  Arraste o arquivo aqui ou{" "}
                  <span className="text-white underline">clique para selecionar</span>
                </p>
                <p className="text-xs text-zinc-600">
                  CONTROLE_DE_VEÍCULOS_MULTIPORTAL.xlsx
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Botão gerar */}
          <button
            onClick={handleGenerate}
            disabled={!file || loading}
            className="
              w-full rounded-xl bg-white py-3
              text-sm font-semibold text-black
              transition hover:bg-zinc-200
              disabled:cursor-not-allowed disabled:opacity-40
            "
          >
            {loading ? "Processando..." : "Gerar e Baixar"}
          </button>

        </div>

      </div>

      {/* Resultado */}
      {result && (
        <div className="space-y-4">

          {/* Contadores */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
              <p className="text-3xl font-bold text-white">{result.updated.length}</p>
              <p className="mt-1 text-sm text-zinc-400">Atualizados</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
              <p className="text-3xl font-bold text-yellow-400">{result.notInGrid.length}</p>
              <p className="mt-1 text-sm text-zinc-400">Na planilha, fora do sistema</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
              <p className="text-3xl font-bold text-orange-400">{result.notInSheet.length}</p>
              <p className="mt-1 text-sm text-zinc-400">No sistema, fora da planilha</p>
            </div>
          </div>

          {/* Na planilha mas fora do sistema */}
          {result.notInGrid.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 p-4">
                <p className="text-sm font-semibold text-yellow-400">
                  Na planilha mas não encontrados no sistema
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Podem ser veículos inativos ou de teste — mantidos na planilha sem alteração.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {result.notInGrid.map((plate) => (
                  <span
                    key={plate}
                    className="rounded-lg bg-zinc-800 px-3 py-1 font-mono text-sm"
                  >
                    {plate}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* No sistema mas fora da planilha */}
          {result.notInSheet.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 p-4">
                <p className="text-sm font-semibold text-orange-400">
                  No sistema mas ausentes da planilha
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Adicione manualmente ou inclua na planilha com o formulário abaixo.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {result.notInSheet.map((plate) => (
                  <button
                    key={plate}
                    onClick={() => setAddForm((f) => ({ ...f, plate }))}
                    className="
                      rounded-lg bg-zinc-800 px-3 py-1 font-mono text-sm
                      transition hover:bg-zinc-700
                    "
                    title="Clique para preencher o formulário"
                  >
                    {plate}
                  </button>
                ))}
              </div>

              {/* Formulário de adição */}
              <div className="border-t border-zinc-800 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Adicionar à planilha
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Placa"
                    value={addForm.plate}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, plate: e.target.value }))
                    }
                    className="
                      w-36 rounded-lg border border-zinc-700 bg-zinc-950
                      px-3 py-2 font-mono text-sm
                      placeholder:text-zinc-600
                      focus:outline-none focus:ring-1 focus:ring-zinc-500
                    "
                  />
                  <input
                    type="text"
                    placeholder="Nome / Razão Social"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="
                      flex-1 rounded-lg border border-zinc-700 bg-zinc-950
                      px-3 py-2 text-sm
                      placeholder:text-zinc-600
                      focus:outline-none focus:ring-1 focus:ring-zinc-500
                    "
                  />
                  <button
                    onClick={handleAddToSheet}
                    disabled={!addForm.plate}
                    className="
                      rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold
                      transition hover:bg-zinc-600
                      disabled:cursor-not-allowed disabled:opacity-40
                    "
                  >
                    Adicionar e Baixar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
