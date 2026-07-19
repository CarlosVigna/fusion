package com.fusion.fusion.sinistro;

import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class SinistroReportFileService {

    public byte[] buildExcelReport(SinistroStatusResponse s) throws IOException {

        try (Workbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Análise de Sinistro");

            int r = 0;

            // ── Cabeçalho ────────────────────────────────────────────────
            r = addRow(sheet, r, "ANÁLISE DE SINISTRO — RELATÓRIO DE INDÍCIOS", null);
            r = addRow(sheet, r, "Gerado em",
                    LocalDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) + " UTC");
            r++;

            r = addRow(sheet, r, "Placa", s.plate());
            r = addRow(sheet, r, "Segurado", s.insuredName());
            r = addRow(sheet, r, "Tipo de sinistro",
                    s.sinistroType() == SinistroType.COLISAO ? "COLISÃO" : "ROUBO/FURTO");
            r = addRow(sheet, r, "Data do sinistro", s.sinistroDate() != null ? s.sinistroDate().toString() : "—");
            r = addRow(sheet, r, "Hora declarada", s.sinistroTime() != null ? s.sinistroTime() : "—");
            r = addRow(sheet, r, "Período analisado", s.startDate() + " a " + s.endDate());
            r++;

            SinistroIndicators ind = s.indicators();

            if (ind != null) {

                // ── KM ───────────────────────────────────────────────────
                r = addRow(sheet, r, "── KM DO PERÍODO ──", null);
                r = addRow(sheet, r, "KM total no período", ind.totalKm());
                r = addRow(sheet, r, "Média diária de KM", ind.avgDailyKm());
                r = addRow(sheet, r, "Dia com maior KM", ind.maxKmDate() != null ? ind.maxKmDate().toString() : null);
                r = addRow(sheet, r, "KM máximo em um dia", ind.maxKmValue());
                r = addRow(sheet, r, "KM no dia do sinistro", ind.kmOnSinistroDate());
                r = addRow(sheet, r, "Razão KM sinistro/média",
                        ind.kmSinistroRatio() != null ? String.format("%.0f%%", ind.kmSinistroRatio() * 100) : null);
                r = addRow(sheet, r, "KM médio — 7 dias anteriores", ind.avgKmLast7Days());
                r++;

                // ── Velocidade ───────────────────────────────────────────
                r = addRow(sheet, r, "── VELOCIDADE ──", null);
                r = addRow(sheet, r, "Ocorrências no período", ind.speedingOccurrences());
                r = addRow(sheet, r, "Ocorrências — 7 dias anteriores", ind.speedingLast7Days());
                r = addRow(sheet, r, "Velocidade máxima registrada (km/h)", ind.maxSpeed());
                r++;

                // ── Indícios ─────────────────────────────────────────────
                r = addRow(sheet, r, "── INDÍCIOS IDENTIFICADOS ──", null);
                Row headerRow = sheet.createRow(r++);
                headerRow.createCell(0).setCellValue("Classificação");
                headerRow.createCell(1).setCellValue("Descrição");

                if (ind.indicios() != null) {
                    for (var indicio : ind.indicios()) {
                        Row row = sheet.createRow(r++);
                        row.createCell(0).setCellValue(
                                switch (indicio.classificacao()) {
                                    case "SUSPEITO" -> "🔴 SUSPEITO";
                                    case "ATENCAO"  -> "⚠️ ATENÇÃO";
                                    default          -> "✅ NORMAL";
                                });
                        row.createCell(1).setCellValue(indicio.descricao());
                    }
                }

                r++;
                r = addRow(sheet, r, "── METODOLOGIA ──", null);
                r = addRow(sheet, r, "Fonte dos dados", "Multiportal (KM Mensal + Excesso de Velocidade)");
                r = addRow(sheet, r, "Nota",
                        "Esta análise é um auxílio à decisão e não substitui a avaliação do analista.");

            }

            sheet.setColumnWidth(0, 40 * 256);
            sheet.setColumnWidth(1, 60 * 256);

            wb.write(out);
            return out.toByteArray();

        }

    }

    public byte[] buildPdfReport(SinistroStatusResponse s) throws IOException {

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Document doc = new Document();

            try {
                PdfWriter.getInstance(doc, out);
                doc.open();

                Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14);
                Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
                Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 9);

                doc.add(new Paragraph("ANÁLISE DE SINISTRO — RELATÓRIO DE INDÍCIOS", titleFont));
                doc.add(new Paragraph(" "));

                String report = s.report() != null
                        ? s.report()
                        : "Relatório ainda não disponível para esta análise.";

                for (String line : report.split("\n")) {
                    Font f = line.startsWith("─") || line.startsWith("ANÁLISE") || line.endsWith("──")
                            ? headerFont : bodyFont;
                    doc.add(new Paragraph(line.isBlank() ? " " : line, f));
                }

            } catch (com.lowagie.text.DocumentException e) {
                throw new IOException("Falha ao gerar PDF", e);
            } finally {
                doc.close();
            }

            return out.toByteArray();

        }

    }

    public byte[] buildPack(Path analysisDir, SinistroStatusResponse s) throws IOException {

        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(out)) {

            if (Files.isDirectory(analysisDir)) {
                try (var files = Files.list(analysisDir)) {
                    for (Path file : files.toList()) {
                        if (Files.isRegularFile(file)) {
                            zip.putNextEntry(new ZipEntry(file.getFileName().toString()));
                            zip.write(Files.readAllBytes(file));
                            zip.closeEntry();
                        }
                    }
                }
            }

            zip.putNextEntry(new ZipEntry("relatorio.xlsx"));
            zip.write(buildExcelReport(s));
            zip.closeEntry();

            zip.putNextEntry(new ZipEntry("relatorio.pdf"));
            zip.write(buildPdfReport(s));
            zip.closeEntry();

            zip.finish();
            return out.toByteArray();

        }

    }

    private int addRow(Sheet sheet, int rowNum, String label, Object value) {
        Row row = sheet.createRow(rowNum);
        row.createCell(0).setCellValue(label);
        if (value instanceof Double d) {
            row.createCell(1).setCellValue(d);
        } else if (value instanceof Integer i) {
            row.createCell(1).setCellValue(i);
        } else if (value != null) {
            row.createCell(1).setCellValue(value.toString());
        }
        return rowNum + 1;
    }

}
