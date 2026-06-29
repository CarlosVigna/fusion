import ExcelJS from "exceljs";

import { jsPDF } from "jspdf";

import { autoTable } from "jspdf-autotable";

// Paleta da marca, igual ao Sidebar (caixa branca + "F" preto sobre
// fundo zinc-950) — repetida aqui em ARGB (ExcelJS) e RGB (jsPDF) pra
// manter o mesmo visual nas exportacoes.
const BRAND_DARK = "FF09090B"; // zinc-950
const BRAND_HEADER = "FF18181B"; // zinc-900
const BRAND_MUTED = "FF71717A"; // zinc-500
const BRAND_DARK_RGB = [9, 9, 11];
const BRAND_HEADER_RGB = [24, 24, 27];
const BRAND_MUTED_RGB = [113, 113, 122];

function buildMeta(filters) {

  const generatedAt = new Date().toLocaleString("pt-BR");

  const entries = Object.entries(filters || {}).filter(
    ([, value]) => value != null && value !== ""
  );

  const filtersText = entries.length > 0
    ? entries.map(([key, value]) => `${key}: ${value}`).join("  ·  ")
    : "Nenhum filtro aplicado";

  return { generatedAt, filtersText };

}

function downloadBlob(blob, filename) {

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = filename;

  link.click();

  URL.revokeObjectURL(url);

}

// Excel corporativo: marca, titulo do relatorio, data/hora, filtros
// aplicados, cabecalho da tabela com destaque, colunas com largura
// ajustada automaticamente ao conteudo, e rodape discreto.
export async function exportReportToExcel({
  title,
  headers,
  rows,
  filters,
  filename,
}) {

  const { generatedAt, filtersText } = buildMeta(filters);

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Fusion";

  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Relatório");

  const lastCol = headers.length;

  function mergedTextRow(rowIndex, text, font) {

    sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);

    const cell = sheet.getCell(rowIndex, 1);

    cell.value = text;

    cell.font = font;

    return cell;

  }

  const brandCell = mergedTextRow(
    1,
    "FUSION — Operational Center",
    { bold: true, size: 13, color: { argb: "FFFFFFFF" } }
  );

  brandCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_DARK },
  };

  brandCell.alignment = { vertical: "middle" };

  sheet.getRow(1).height = 24;

  mergedTextRow(2, title, { bold: true, size: 12 });

  mergedTextRow(
    3,
    `Gerado em ${generatedAt}`,
    { italic: true, size: 10, color: { argb: BRAND_MUTED } }
  );

  mergedTextRow(
    4,
    `Filtros: ${filtersText}`,
    { italic: true, size: 10, color: { argb: BRAND_MUTED } }
  );

  const headerRowIndex = 6;

  const headerRow = sheet.getRow(headerRowIndex);

  headers.forEach((header, index) => {

    const cell = headerRow.getCell(index + 1);

    cell.value = header;

    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_HEADER },
    };

    cell.alignment = { vertical: "middle" };

  });

  headerRow.height = 20;

  rows.forEach((row, rowOffset) => {

    const excelRow = sheet.getRow(headerRowIndex + 1 + rowOffset);

    row.forEach((value, columnIndex) => {

      excelRow.getCell(columnIndex + 1).value = value ?? "";

    });

  });

  // Ajuste automatico de largura — maior valor entre cabecalho e
  // conteudo de cada coluna, com limites pra nao ficar absurdo.
  headers.forEach((header, index) => {

    const columnValues = [
      header,
      ...rows.map((row) => String(row[index] ?? "")),
    ];

    const maxLength = Math.max(
      ...columnValues.map((value) => value.length)
    );

    sheet.getColumn(index + 1).width = Math.min(
      Math.max(maxLength + 2, 10),
      50
    );

  });

  const footerRowIndex = headerRowIndex + rows.length + 2;

  mergedTextRow(
    footerRowIndex,
    "Documento gerado automaticamente pelo Fusion — uso interno",
    { italic: true, size: 9, color: { argb: BRAND_MUTED } }
  );

  const buffer = await workbook.xlsx.writeBuffer();

  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );

}

// PDF corporativo: mesma faixa de marca, titulo, metadados e tabela —
// pronto pra ser enviado a clientes/gestores.
export function exportReportToPdf({
  title,
  headers,
  rows,
  filters,
  filename,
}) {

  const orientation = headers.length > 6 ? "landscape" : "portrait";

  const doc = new jsPDF({ orientation });

  const pageWidth = doc.internal.pageSize.getWidth();

  const { generatedAt, filtersText } = buildMeta(filters);

  doc.setFillColor(...BRAND_DARK_RGB);

  doc.rect(0, 0, pageWidth, 16, "F");

  doc.setTextColor(255, 255, 255);

  doc.setFontSize(13);

  doc.setFont(undefined, "bold");

  doc.text("FUSION", 10, 11);

  doc.setFontSize(9);

  doc.setFont(undefined, "normal");

  doc.text("Operational Center", pageWidth - 10, 11, { align: "right" });

  doc.setTextColor(20, 20, 23);

  doc.setFontSize(13);

  doc.setFont(undefined, "bold");

  doc.text(title, 10, 26);

  doc.setFontSize(9);

  doc.setFont(undefined, "normal");

  doc.setTextColor(...BRAND_MUTED_RGB);

  doc.text(`Gerado em ${generatedAt}`, 10, 32);

  doc.text(`Filtros: ${filtersText}`, 10, 37);

  autoTable(doc, {

    head: [headers],

    body: rows.map((row) => row.map((value) => value ?? "")),

    startY: 43,

    styles: { fontSize: 8, cellPadding: 2.5 },

    headStyles: {
      fillColor: BRAND_HEADER_RGB,
      textColor: 255,
      fontStyle: "bold",
    },

    alternateRowStyles: { fillColor: [245, 245, 246] },

    didDrawPage: (data) => {

      doc.setFontSize(8);

      doc.setTextColor(...BRAND_MUTED_RGB);

      doc.text(
        `Fusion — documento confidencial — página ${data.pageNumber}`,
        10,
        doc.internal.pageSize.getHeight() - 8
      );

    },

  });

  doc.save(filename);

}
