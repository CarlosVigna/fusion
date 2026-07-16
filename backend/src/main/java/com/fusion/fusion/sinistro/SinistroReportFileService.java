package com.fusion.fusion.sinistro;

import com.lowagie.text.Document;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

// Geracao dos arquivos de download do modulo de Sinistro. Formatacao
// deliberadamente simples (sem cores/bordas) — o foco desta primeira
// versao e' os dados estarem corretos, nao o design do documento.
@Service
public class SinistroReportFileService {

    public byte[] buildExcelReport(SinistroStatusResponse status) throws IOException {

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Análise de Sinistro");

            int rowNum = 0;

            rowNum = addRow(sheet, rowNum, "Placa", status.plate());
            rowNum = addRow(sheet, rowNum, "Segurado", status.insuredName());
            rowNum = addRow(sheet, rowNum, "Período", status.startDate() + " a " + status.endDate());
            rowNum = addRow(sheet, rowNum, "Status", status.status().name());

            rowNum++;

            SinistroIndicators indicators = status.indicators();

            if (indicators != null) {

                rowNum = addRow(sheet, rowNum, "KM total", indicators.totalKm());
                rowNum = addRow(sheet, rowNum, "Média diária de KM", indicators.avgDailyKm());
                rowNum = addRow(sheet, rowNum, "Dia com maior KM", indicators.maxKmDate());
                rowNum = addRow(sheet, rowNum, "Maior KM em um dia", indicators.maxKmValue());
                rowNum = addRow(sheet, rowNum, "Ocorrências de excesso de velocidade", indicators.speedingOccurrences());
                rowNum = addRow(sheet, rowNum, "Velocidade máxima registrada", indicators.maxSpeed());

                rowNum++;

                Row header = sheet.createRow(rowNum++);
                header.createCell(0).setCellValue("Dias suspeitos (KM > 2x a média)");
                header.createCell(1).setCellValue("KM");

                for (SinistroIndicators.SuspiciousDay day : indicators.suspiciousDays()) {
                    Row row = sheet.createRow(rowNum++);
                    row.createCell(0).setCellValue(day.date().toString());
                    row.createCell(1).setCellValue(day.km());
                }

            }

            for (int i = 0; i <= 1; i++) {
                sheet.setColumnWidth(i, 30 * 256);
            }

            workbook.write(out);

            return out.toByteArray();

        }

    }

    public byte[] buildPdfReport(SinistroStatusResponse status) throws IOException {

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Document document = new Document();

            try {

                PdfWriter.getInstance(document, out);

                document.open();

                String report = status.report() != null
                        ? status.report()
                        : "Relatório ainda não disponível para esta análise.";

                for (String line : report.split("\n")) {
                    document.add(new Paragraph(line));
                }

            } catch (com.lowagie.text.DocumentException e) {
                throw new IOException("Falha ao gerar PDF", e);
            } finally {
                document.close();
            }

            return out.toByteArray();

        }

    }

    public byte[] buildPack(Path analysisDir, SinistroStatusResponse status) throws IOException {

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
            zip.write(buildExcelReport(status));
            zip.closeEntry();

            zip.putNextEntry(new ZipEntry("relatorio.pdf"));
            zip.write(buildPdfReport(status));
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
