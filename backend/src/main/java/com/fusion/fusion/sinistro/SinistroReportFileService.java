package com.fusion.fusion.sinistro;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfTemplate;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.awt.Color;
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

    // ── Excel ────────────────────────────────────────────────────────────

    public byte[] buildExcelReport(SinistroStatusResponse s) throws IOException {

        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFSheet sheet = wb.createSheet("Análise de Sinistro");

            CellStyle titleSty  = createTitleStyle(wb);
            CellStyle sectSty   = createSectionStyle(wb);
            CellStyle headSty   = createHeaderStyle(wb);
            CellStyle labelSty  = createLabelStyle(wb);
            CellStyle valueSty  = createValueStyle(wb);
            CellStyle altSty    = createAltStyle(wb);
            CellStyle suspSty   = createBadgeStyle(wb, new XSSFColor(new byte[]{(byte)220, 38, 38}, null));
            CellStyle atencSty  = createBadgeStyle(wb, new XSSFColor(new byte[]{(byte)217, (byte)119, 6}, null));
            CellStyle normSty   = createBadgeStyle(wb, new XSSFColor(new byte[]{22, (byte)163, 74}, null));

            int r = 0;

            // Título
            XSSFRow titleRow = sheet.createRow(r++);
            XSSFCell tc = titleRow.createCell(0);
            tc.setCellValue("ANÁLISE DE SINISTRO — RELATÓRIO DE INDÍCIOS");
            tc.setCellStyle(titleSty);
            sheet.addMergedRegion(new CellRangeAddress(r - 1, r - 1, 0, 2));
            r++;

            // Identificação
            r = xlRow(sheet, r, "Placa",           orDash(s.plate()),                                 labelSty, valueSty);
            r = xlRow(sheet, r, "Segurado",        orDash(s.insuredName()),                           labelSty, valueSty);
            r = xlRow(sheet, r, "Tipo de sinistro", s.sinistroType() == SinistroType.COLISAO ? "COLISÃO" : "ROUBO/FURTO", labelSty, valueSty);
            r = xlRow(sheet, r, "Data do sinistro",
                    s.sinistroDate() != null ? s.sinistroDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : "—", labelSty, valueSty);
            r = xlRow(sheet, r, "Hora declarada",   s.sinistroTime() != null ? s.sinistroTime() + "h" : "—", labelSty, valueSty);
            r = xlRow(sheet, r, "Período analisado", s.startDate() + " a " + s.endDate(),             labelSty, valueSty);
            r++;

            SinistroIndicators ind = s.indicators();

            if (ind != null) {

                // KM
                r = xlSection(sheet, r, "KM DO PERÍODO", sectSty);
                r = xlRow(sheet, r, "KM total no período",        fmt1(ind.totalKm()) + " km",            labelSty, valueSty);
                r = xlRow(sheet, r, "Média diária",               fmt1(ind.avgDailyKm()) + " km/dia",     labelSty, valueSty);
                r = xlRow(sheet, r, "KM no dia do sinistro",
                        fmt1(ind.kmOnSinistroDate()) + " km" + (ind.kmSinistroRatio() != null
                                ? String.format(" (%.0f%% da média)", ind.kmSinistroRatio() * 100) : ""),
                        labelSty, valueSty);
                r = xlRow(sheet, r, "KM médio — 7 dias anteriores",
                        fmt1(ind.avgKmLast7Days()) + " km/dia" + (ind.avgKmLast7DaysRatio() != null
                                ? String.format(" (%.0f%% da média geral)", ind.avgKmLast7DaysRatio() * 100) : ""),
                        labelSty, valueSty);
                r++;

                // Velocidade
                r = xlSection(sheet, r, "EXCESSO DE VELOCIDADE", sectSty);
                r = xlRow(sheet, r, "Ocorrências no período",            String.valueOf(ind.speedingOccurrences()), labelSty, valueSty);
                r = xlRow(sheet, r, "Ocorrências — 7 dias anteriores",  String.valueOf(ind.speedingLast7Days()),    labelSty, valueSty);
                r = xlRow(sheet, r, "Velocidade máxima registrada",
                        ind.maxSpeed() != null ? fmt0(ind.maxSpeed()) + " km/h" : "—",                      labelSty, valueSty);
                r++;

                // Ignição
                if (ind.totalHorasLigada() != null) {
                    r = xlSection(sheet, r, "IGNIÇÃO", sectSty);
                    r = xlRow(sheet, r, "Total ligada no período",      fmt1(ind.totalHorasLigada()) + " h",    labelSty, valueSty);
                    r = xlRow(sheet, r, "Média por dia com uso",        fmt1(ind.avgHorasLigadaDia()) + " h/dia", labelSty, valueSty);
                    r = xlRow(sheet, r, "Ligada no dia do sinistro",    fmt1(ind.horasLigadaSinistro()) + " h", labelSty, valueSty);
                    r++;
                }

                // Indícios
                r = xlSection(sheet, r, "INDÍCIOS IDENTIFICADOS", sectSty);
                XSSFRow ih = sheet.createRow(r++);
                xlHeaderCell(ih, 0, "Classificação", headSty);
                xlHeaderCell(ih, 1, "Descrição",     headSty);
                xlHeaderCell(ih, 2, "",              headSty);

                if (ind.indicios() != null) {
                    boolean alt = false;
                    for (var i : ind.indicios()) {
                        XSSFRow row = sheet.createRow(r++);
                        XSSFCell bc = row.createCell(0);
                        bc.setCellStyle(switch (i.classificacao()) {
                            case "SUSPEITO" -> suspSty;
                            case "ATENCAO"  -> atencSty;
                            default          -> normSty;
                        });
                        bc.setCellValue(switch (i.classificacao()) {
                            case "SUSPEITO" -> "SUSPEITO";
                            case "ATENCAO"  -> "ATENÇÃO";
                            default          -> "NORMAL";
                        });
                        XSSFCell dc = row.createCell(1);
                        dc.setCellValue(i.descricao());
                        dc.setCellStyle(alt ? altSty : valueSty);
                        alt = !alt;
                    }
                }
                r++;

                // Metodologia
                boolean isColisao = s.sinistroType() == SinistroType.COLISAO;
                r = xlSection(sheet, r, "METODOLOGIA DE ANÁLISE", sectSty);
                XSSFRow mh = sheet.createRow(r++);
                xlHeaderCell(mh, 0, "O que foi verificado", headSty);
                xlHeaderCell(mh, 1, "Fonte dos dados",       headSty);
                xlHeaderCell(mh, 2, "Como interpretamos",    headSty);

                String[][] mRows = isColisao ? new String[][]{
                        {"KM no dia da colisão",     "Planilha KM Mensal",            "vs. média diária do período"},
                        {"Tempo de ignição",         "Planilha Tempo de Ignição",     "Horas ligado no dia da colisão"},
                        {"Excesso de velocidade",    "Planilha Excesso de Velocidade","Ocorrências nos 7 dias anteriores"},
                        {"Horário declarado",        "Informado pelo analista",       "Classificado como Comercial / Noturno / Madrugada"},
                } : new String[][]{
                        {"KM no dia do roubo",       "Planilha KM Mensal",            "vs. média diária do período"},
                        {"Padrão 7 dias antes",      "Planilha KM Mensal",            "Média dos 7 dias vs. média geral"},
                        {"Excesso de velocidade",    "Planilha Excesso de Velocidade","Ocorrências nos 7 dias anteriores"},
                        {"Ignição no dia",           "Planilha Tempo de Ignição",     "Horas ligado no dia declarado"},
                };

                boolean alt2 = false;
                for (String[] mr : mRows) {
                    XSSFRow row = sheet.createRow(r++);
                    CellStyle cs = alt2 ? altSty : valueSty;
                    for (int c = 0; c < mr.length; c++) {
                        XSSFCell cell = row.createCell(c);
                        cell.setCellValue(mr[c]);
                        cell.setCellStyle(cs);
                    }
                    alt2 = !alt2;
                }
                r++;

                r = xlRow(sheet, r, "Gerado em",
                        LocalDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) + " UTC",
                        labelSty, valueSty);
                r = xlRow(sheet, r, "Nota",
                        "Dados extraídos do Multiportal. Esta análise é um auxílio à decisão e não substitui a avaliação do analista.",
                        labelSty, valueSty);
            }

            sheet.setColumnWidth(0, 35 * 256);
            sheet.setColumnWidth(1, 55 * 256);
            sheet.setColumnWidth(2, 45 * 256);

            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── PDF ─────────────────────────────────────────────────────────────

    public byte[] buildPdfReport(SinistroStatusResponse s) throws IOException {

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Document doc = new Document(PageSize.A4, 40, 40, 50, 50);

            try {

                PdfWriter writer = PdfWriter.getInstance(doc, out);
                doc.open();
                PdfContentByte cb = writer.getDirectContent();

                // Cores
                Color BLUE   = new Color(29, 78, 216);
                Color WHITE  = Color.WHITE;
                Color GRAY_L = new Color(248, 250, 252);
                Color GRAY_M = new Color(226, 232, 240);
                Color DARK   = new Color(30, 41, 59);
                Color MUTED  = new Color(100, 116, 139);
                Color LIGHTB = new Color(148, 196, 255);
                Color RED    = new Color(220, 38, 38);
                Color AMBER  = new Color(217, 119, 6);
                Color GREEN  = new Color(22, 163, 74);

                // Fontes
                BaseFont bfR = BaseFont.createFont(BaseFont.HELVETICA,      BaseFont.CP1252, false);
                BaseFont bfB = BaseFont.createFont(BaseFont.HELVETICA_BOLD, BaseFont.CP1252, false);
                Font fTitle  = new Font(bfB, 17, Font.NORMAL, WHITE);
                Font fSub    = new Font(bfR,  9, Font.NORMAL, LIGHTB);
                Font fSecHd  = new Font(bfB, 10, Font.NORMAL, WHITE);
                Font fColHd  = new Font(bfB,  8, Font.NORMAL, DARK);
                Font fLabel  = new Font(bfB,  8, Font.NORMAL, DARK);
                Font fValue  = new Font(bfR,  8, Font.NORMAL, DARK);
                Font fBadge  = new Font(bfB,  7, Font.NORMAL, WHITE);
                Font fSmall  = new Font(bfR,  7, Font.NORMAL, MUTED);

                // Hexágono no PdfTemplate
                PdfTemplate hexTpl = cb.createTemplate(50, 50);
                float hcx = 25f, hcy = 25f, hr = 22f;
                hexTpl.setColorFill(BLUE);
                drawHexPath(hexTpl, hcx, hcy, hr);
                hexTpl.fill();
                hexTpl.setColorStroke(WHITE);
                hexTpl.setLineWidth(2f);
                drawHexPath(hexTpl, hcx, hcy, hr);
                hexTpl.stroke();
                hexTpl.beginText();
                hexTpl.setFontAndSize(bfB, 22);
                hexTpl.setColorFill(WHITE);
                hexTpl.setTextMatrix(14f, 13f);
                hexTpl.showText("F");
                hexTpl.endText();

                Image hexImg = Image.getInstance(hexTpl);
                hexImg.scaleAbsolute(50, 50);

                // Cabeçalho
                PdfPTable hdrTbl = new PdfPTable(new float[]{60, 450});
                hdrTbl.setTotalWidth(510);
                hdrTbl.setLockedWidth(true);

                PdfPCell logoC = new PdfPCell(hexImg, false);
                logoC.setBackgroundColor(BLUE);
                logoC.setBorder(Rectangle.NO_BORDER);
                logoC.setPadding(5);
                logoC.setVerticalAlignment(Element.ALIGN_MIDDLE);
                hdrTbl.addCell(logoC);

                PdfPCell titleC = new PdfPCell();
                titleC.setBackgroundColor(BLUE);
                titleC.setBorder(Rectangle.NO_BORDER);
                titleC.setPaddingLeft(12);
                titleC.setPaddingTop(8);
                titleC.setPaddingBottom(8);
                titleC.setVerticalAlignment(Element.ALIGN_MIDDLE);
                titleC.addElement(new Phrase("ANÁLISE DE SINISTRO", fTitle));
                titleC.addElement(new Phrase(
                        "Relatório de Indícios — " +
                        (s.sinistroType() == SinistroType.COLISAO ? "COLISÃO" : "ROUBO/FURTO"), fSub));
                hdrTbl.addCell(titleC);
                doc.add(hdrTbl);
                vspace(doc);

                // Bloco de identificação (4 colunas: label | valor | label | valor)
                PdfPTable infoTbl = new PdfPTable(new float[]{110, 145, 110, 145});
                infoTbl.setTotalWidth(510);
                infoTbl.setLockedWidth(true);

                infoPair(infoTbl, "Placa", orDash(s.plate()),
                         "Segurado", orDash(s.insuredName()), GRAY_L, WHITE, fLabel, fValue);
                infoPair(infoTbl, "Tipo de sinistro",
                         s.sinistroType() == SinistroType.COLISAO ? "COLISÃO" : "ROUBO/FURTO",
                         "Período analisado", s.startDate() + "  →  " + s.endDate(),
                         WHITE, GRAY_L, fLabel, fValue);
                infoPair(infoTbl, "Data do sinistro",
                         s.sinistroDate() != null
                             ? s.sinistroDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : "—",
                         "Hora declarada",
                         s.sinistroTime() != null ? s.sinistroTime() + "h" : "—",
                         GRAY_L, WHITE, fLabel, fValue);
                doc.add(infoTbl);
                vspace(doc);

                SinistroIndicators ind = s.indicators();

                // Indícios
                if (ind != null && ind.indicios() != null && !ind.indicios().isEmpty()) {

                    doc.add(secHeader("INDÍCIOS IDENTIFICADOS", fSecHd, BLUE));

                    PdfPTable tbl = new PdfPTable(new float[]{75, 435});
                    tbl.setTotalWidth(510);
                    tbl.setLockedWidth(true);

                    boolean alt = false;
                    for (var i : ind.indicios()) {
                        Color rowBg = alt ? GRAY_L : WHITE;
                        alt = !alt;

                        String badgeLabel;
                        Color badgeColor;
                        switch (i.classificacao()) {
                            case "SUSPEITO" -> { badgeLabel = "SUSPEITO"; badgeColor = RED; }
                            case "ATENCAO"  -> { badgeLabel = "ATENÇÃO";  badgeColor = AMBER; }
                            default         -> { badgeLabel = "NORMAL";   badgeColor = GREEN; }
                        }

                        PdfPCell bc = new PdfPCell(new Phrase(badgeLabel, fBadge));
                        bc.setBackgroundColor(badgeColor);
                        bc.setBorder(Rectangle.NO_BORDER);
                        bc.setPadding(5);
                        bc.setHorizontalAlignment(Element.ALIGN_CENTER);
                        bc.setVerticalAlignment(Element.ALIGN_MIDDLE);
                        tbl.addCell(bc);

                        PdfPCell dc = new PdfPCell(new Phrase(i.descricao(), fValue));
                        dc.setBackgroundColor(rowBg);
                        dc.setBorder(Rectangle.NO_BORDER);
                        dc.setPadding(5);
                        dc.setVerticalAlignment(Element.ALIGN_MIDDLE);
                        tbl.addCell(dc);
                    }
                    doc.add(tbl);
                    vspace(doc);
                }

                // KM
                if (ind != null && ind.totalKm() != null) {
                    doc.add(secHeader("DADOS DE KM", fSecHd, BLUE));
                    doc.add(metricsTable(new String[][]{
                            {"KM total no período",        fmt1(ind.totalKm()) + " km"},
                            {"Média diária",               fmt1(ind.avgDailyKm()) + " km/dia"},
                            {"KM no dia do sinistro",      fmt1(ind.kmOnSinistroDate()) + " km" +
                                    (ind.kmSinistroRatio() != null
                                            ? String.format("  (%.0f%% da média)", ind.kmSinistroRatio() * 100) : "")},
                            {"KM médio — 7 dias anteriores", fmt1(ind.avgKmLast7Days()) + " km/dia" +
                                    (ind.avgKmLast7DaysRatio() != null
                                            ? String.format("  (%.0f%% da média geral)", ind.avgKmLast7DaysRatio() * 100) : "")},
                    }, fLabel, fValue, GRAY_L, WHITE));
                    vspace(doc);
                }

                // Velocidade
                if (ind != null) {
                    doc.add(secHeader("EXCESSO DE VELOCIDADE", fSecHd, BLUE));
                    doc.add(metricsTable(new String[][]{
                            {"Ocorrências no período",            String.valueOf(ind.speedingOccurrences())},
                            {"Ocorrências — 7 dias anteriores",  String.valueOf(ind.speedingLast7Days())},
                            {"Velocidade máxima registrada",      ind.maxSpeed() != null ? fmt0(ind.maxSpeed()) + " km/h" : "—"},
                    }, fLabel, fValue, GRAY_L, WHITE));
                    vspace(doc);
                }

                // Ignição
                if (ind != null && ind.totalHorasLigada() != null) {
                    doc.add(secHeader("IGNIÇÃO", fSecHd, BLUE));
                    doc.add(metricsTable(new String[][]{
                            {"Total ligada no período",  fmt1(ind.totalHorasLigada()) + " h"},
                            {"Média por dia com uso",    fmt1(ind.avgHorasLigadaDia()) + " h/dia"},
                            {"Ligada no dia do sinistro", fmt1(ind.horasLigadaSinistro()) + " h"},
                    }, fLabel, fValue, GRAY_L, WHITE));
                    vspace(doc);
                }

                // Metodologia
                boolean isColisao = s.sinistroType() == SinistroType.COLISAO;
                doc.add(secHeader("METODOLOGIA DE ANÁLISE", fSecHd, BLUE));

                PdfPTable mTbl = new PdfPTable(new float[]{140, 170, 200});
                mTbl.setTotalWidth(510);
                mTbl.setLockedWidth(true);

                for (String col : new String[]{"O que foi verificado", "Fonte dos dados", "Como interpretamos"}) {
                    PdfPCell th = new PdfPCell(new Phrase(col, fColHd));
                    th.setBackgroundColor(GRAY_M);
                    th.setBorder(Rectangle.NO_BORDER);
                    th.setPadding(5);
                    mTbl.addCell(th);
                }

                String[][] mRows = isColisao ? new String[][]{
                        {"KM no dia da colisão",    "Planilha KM Mensal",             "vs. média diária do período"},
                        {"Tempo de ignição",        "Planilha Tempo de Ignição",      "Horas ligado no dia da colisão"},
                        {"Excesso de velocidade",   "Planilha Excesso de Velocidade", "Ocorrências nos 7 dias anteriores"},
                        {"Horário declarado",       "Informado pelo analista",        "Comercial / Noturno / Madrugada"},
                } : new String[][]{
                        {"KM no dia do roubo",      "Planilha KM Mensal",             "vs. média diária do período"},
                        {"Padrão 7 dias antes",     "Planilha KM Mensal",             "Média dos 7 dias vs. média geral"},
                        {"Excesso de velocidade",   "Planilha Excesso de Velocidade", "Ocorrências nos 7 dias anteriores"},
                        {"Ignição no dia",          "Planilha Tempo de Ignição",      "Horas ligado no dia declarado"},
                };

                boolean altM = false;
                for (String[] mr : mRows) {
                    Color bg = altM ? GRAY_L : WHITE;
                    altM = !altM;
                    for (String cell : mr) {
                        PdfPCell td = new PdfPCell(new Phrase(cell, fValue));
                        td.setBackgroundColor(bg);
                        td.setBorder(Rectangle.NO_BORDER);
                        td.setPadding(5);
                        mTbl.addCell(td);
                    }
                }
                doc.add(mTbl);
                vspace(doc);

                // Rodapé
                String ts = LocalDateTime.now(ZoneOffset.UTC)
                        .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) + " UTC";
                PdfPTable ftTbl = new PdfPTable(1);
                ftTbl.setTotalWidth(510);
                ftTbl.setLockedWidth(true);
                PdfPCell ftC = new PdfPCell(new Phrase(
                        "Análise gerada pelo Fusion em " + ts +
                        ". Dados extraídos do Multiportal. " +
                        "Esta análise é um auxílio à decisão e não substitui a avaliação do analista de sinistros.",
                        fSmall));
                ftC.setBackgroundColor(GRAY_L);
                ftC.setBorder(Rectangle.NO_BORDER);
                ftC.setPadding(8);
                ftTbl.addCell(ftC);
                doc.add(ftTbl);

            } catch (DocumentException e) {
                throw new IOException("Falha ao gerar PDF", e);
            } finally {
                doc.close();
            }

            return out.toByteArray();
        }
    }

    // ── Pack (ZIP) ───────────────────────────────────────────────────────

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

    // ── PDF helpers ──────────────────────────────────────────────────────

    private void drawHexPath(PdfContentByte cb, float cx, float cy, float r) {
        for (int i = 0; i < 6; i++) {
            double angle = Math.PI / 2.0 + i * Math.PI / 3.0;
            float px = cx + r * (float) Math.cos(angle);
            float py = cy + r * (float) Math.sin(angle);
            if (i == 0) cb.moveTo(px, py);
            else cb.lineTo(px, py);
        }
        cb.closePath();
    }

    private PdfPTable secHeader(String title, Font font, Color bg) {
        PdfPTable t = new PdfPTable(1);
        t.setTotalWidth(510);
        t.setLockedWidth(true);
        PdfPCell c = new PdfPCell(new Phrase(title, font));
        c.setBackgroundColor(bg);
        c.setBorder(Rectangle.NO_BORDER);
        c.setPadding(7);
        t.addCell(c);
        return t;
    }

    private PdfPTable metricsTable(String[][] rows, Font fLabel, Font fValue,
                                    Color c1, Color c2) {
        PdfPTable t = new PdfPTable(new float[]{200, 310});
        t.setTotalWidth(510);
        t.setLockedWidth(true);
        boolean alt = false;
        for (String[] row : rows) {
            Color bg = alt ? c1 : c2;
            alt = !alt;
            PdfPCell lc = new PdfPCell(new Phrase(row[0], fLabel));
            lc.setBackgroundColor(bg); lc.setBorder(Rectangle.NO_BORDER); lc.setPadding(5);
            t.addCell(lc);
            PdfPCell vc = new PdfPCell(new Phrase(row.length > 1 ? row[1] : "—", fValue));
            vc.setBackgroundColor(bg); vc.setBorder(Rectangle.NO_BORDER); vc.setPadding(5);
            t.addCell(vc);
        }
        return t;
    }

    private void infoPair(PdfPTable t,
                           String l1, String v1, String l2, String v2,
                           Color bg1, Color bg2, Font fLabel, Font fValue) {
        for (String[] pair : new String[][]{{l1, v1, "1"}, {l2, v2, "2"}}) {
            Color bg = "1".equals(pair[2]) ? bg1 : bg2;
            PdfPCell lc = new PdfPCell(new Phrase(pair[0], fLabel));
            lc.setBackgroundColor(bg); lc.setBorder(Rectangle.NO_BORDER); lc.setPadding(5);
            t.addCell(lc);
            PdfPCell vc = new PdfPCell(new Phrase(pair[1], fValue));
            vc.setBackgroundColor(bg); vc.setBorder(Rectangle.NO_BORDER); vc.setPadding(5);
            t.addCell(vc);
        }
    }

    private void vspace(Document doc) throws DocumentException {
        doc.add(new Paragraph(4, " "));
    }

    // ── Excel helpers ────────────────────────────────────────────────────

    private int xlRow(XSSFSheet sheet, int r, String label, String value,
                       CellStyle ls, CellStyle vs) {
        XSSFRow row = sheet.createRow(r);
        XSSFCell lc = row.createCell(0);
        lc.setCellValue(label); lc.setCellStyle(ls);
        XSSFCell vc = row.createCell(1);
        vc.setCellValue(orDash(value)); vc.setCellStyle(vs);
        return r + 1;
    }

    private int xlSection(XSSFSheet sheet, int r, String title, CellStyle style) {
        XSSFRow row = sheet.createRow(r);
        XSSFCell c = row.createCell(0);
        c.setCellValue(title); c.setCellStyle(style);
        return r + 1;
    }

    private void xlHeaderCell(XSSFRow row, int col, String value, CellStyle style) {
        XSSFCell c = row.createCell(col);
        c.setCellValue(value);
        c.setCellStyle(style);
    }

    private CellStyle createTitleStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 13);
        f.setColor(new XSSFColor(new byte[]{29, 78, (byte) 216}, null));
        s.setFont(f);
        return s;
    }

    private CellStyle createSectionStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 9);
        f.setColor(new XSSFColor(new byte[]{(byte) 255, (byte) 255, (byte) 255}, null));
        s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{29, 78, (byte) 216}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private CellStyle createHeaderStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 9);
        s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 226, (byte) 232, (byte) 240}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private CellStyle createLabelStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 9);
        s.setFont(f);
        return s;
    }

    private CellStyle createValueStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setFontHeightInPoints((short) 9);
        s.setFont(f);
        return s;
    }

    private CellStyle createAltStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setFontHeightInPoints((short) 9);
        s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 248, (byte) 250, (byte) 252}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private CellStyle createBadgeStyle(XSSFWorkbook wb, XSSFColor color) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 9);
        f.setColor(new XSSFColor(new byte[]{(byte) 255, (byte) 255, (byte) 255}, null));
        s.setFont(f);
        s.setFillForegroundColor(color);
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.CENTER);
        return s;
    }

    // ── Formatação ───────────────────────────────────────────────────────

    private String fmt1(Double v) {
        return v != null ? String.format("%.1f", v) : "—";
    }

    private String fmt0(Double v) {
        return v != null ? String.format("%.0f", v) : "—";
    }

    private String orDash(String v) {
        return (v != null && !v.isBlank()) ? v : "—";
    }
}
