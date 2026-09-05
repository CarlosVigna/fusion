package com.fusion.fusion.linecancel;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.policy.Policy;
import com.fusion.fusion.policy.PolicyRepository;
import com.fusion.fusion.policy.PolicyResponse;
import com.fusion.fusion.policy.PolicyStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

// Controle de cancelamento de linha de chip — veiculos cuja apolice foi
// cancelada/encerrada precisam ter a linha do chip cancelada junto com
// a operadora, senao ela continua sendo cobrada. Ver LineCancelStatus
// pro fluxo (AGUARDANDO -> VERIFICAR -> PRONTO -> SOLICITADO -> CONCLUIDO).
@Slf4j
@Service
@RequiredArgsConstructor
public class LineCancelService {

    private final LineCancelRepository repository;

    private final PolicyRepository policyRepository;

    private final DeviceLinkageRepository linkageRepository;

    // Apos esse numero de dias sem verificacao manual, promove
    // AGUARDANDO -> VERIFICAR.
    private static final int VERIFY_AFTER_DAYS = 30;

    private static final EnumSet<PolicyStatus> TARGET_STATUSES =
            EnumSet.of(PolicyStatus.CANCELLED, PolicyStatus.CLOSED, PolicyStatus.EXPIRED);

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // De proposito sem filtro por vehicle.deletedAt — o historico de
    // cancelamento e' permanente (ver comentario em LineCancel.vehicle),
    // a aba Concluidas precisa continuar mostrando registros de
    // veiculos ja soft-deletados. VehicleService.delete() so seta
    // deletedAt, nunca apaga linhas de outras tabelas.
    @Transactional
    public List<LineCancelResponse> findAll(LineCancelStatus filterStatus) {

        List<LineCancel> all = repository.findAll();

        boolean changed = false;

        for (LineCancel lc : all) {

            LineCancelStatus before = lc.getStatus();

            updateStatus(lc);

            if (lc.getStatus() != before) {
                changed = true;
            }

        }

        if (changed) {
            repository.saveAll(all);
        }

        List<LineCancel> filtered = filterStatus != null
                ? all.stream().filter(lc -> lc.getStatus() == filterStatus).toList()
                : all;

        return filtered.stream()
                .sorted(Comparator.comparing(
                        LineCancel::getPolicyEndDate,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ))
                .map(LineCancelResponse::from)
                .toList();

    }

    // Usado pelas abas com filtro (Verificar/Pronto/Solicitado/
    // Concluidas) e pela exportacao — Aguardando nao chama isso, mostra
    // sempre tudo sem filtro nenhum (pedido explicito).
    public List<LineCancelResponse> findFiltered(
            LineCancelStatus status,
            String plate,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {

        String plateFilter = plate != null && !plate.isBlank()
                ? plate.trim().toUpperCase()
                : null;

        return findAll(status).stream()
                .filter(r -> plateFilter == null
                        || (r.plate() != null && r.plate().toUpperCase().contains(plateFilter)))
                .filter(r -> matchesDateRange(referenceDate(r), dateFrom, dateTo))
                .toList();

    }

    private boolean matchesDateRange(LocalDate date, LocalDate from, LocalDate to) {

        if (from == null && to == null) {
            return true;
        }

        if (date == null) {
            return false;
        }

        if (from != null && date.isBefore(from)) {
            return false;
        }

        if (to != null && date.isAfter(to)) {
            return false;
        }

        return true;

    }

    public byte[] exportFiltered(
            LineCancelStatus status,
            String plate,
            LocalDate dateFrom,
            LocalDate dateTo,
            String format
    ) {

        List<LineCancelResponse> items = findFiltered(status, plate, dateFrom, dateTo);

        List<String> headers = List.of(
                "Placa", "Segurado", "ICCID", "MSISDN", "IMEI",
                "Status Apólice", "Data Cancelamento", "Dias", "Status"
        );

        List<List<String>> table = new ArrayList<>();

        for (LineCancelResponse r : items) {

            LocalDate ref = referenceDate(r);

            table.add(List.of(
                    nvl(r.plate()),
                    nvl(r.insuredName()),
                    nvl(r.iccid()),
                    nvl(r.msisdn()),
                    nvl(r.imei()),
                    nvl(r.policyStatus()),
                    ref != null ? ref.format(DATE_FMT) : "",
                    ref != null ? String.valueOf(ChronoUnit.DAYS.between(ref, LocalDate.now(ZoneOffset.UTC))) : "",
                    r.status() != null ? r.status().name() : ""
            ));

        }

        return "PDF".equalsIgnoreCase(format)
                ? generatePdf(headers, table)
                : generateExcel(headers, table);

    }

    // Varre apolices CANCELLED/CLOSED/EXPIRED de veiculos ativos e cria
    // um LineCancel pra cada uma que ainda nao tem registro (dedup por
    // vehicle + policyEndDate, ver LineCancelRepository). Reaproveita o
    // ICCID/MSISDN/IMEI do device vinculado ao veiculo via DeviceLinkage
    // ativa — mesmo padrao ja usado em ReportCustomService/
    // VehicleGridService pra resolver o device "atual" de um veiculo.
    // cancelledAt nunca e' preenchido aqui — pra CANCELLED fica pendente
    // de preenchimento manual (ver setCancelledAt()); pra CLOSED/EXPIRED
    // nem chega a ser usado, a referencia e' sempre policyEndDate.
    @Transactional
    public int syncFromPolicies() {

        Map<UUID, DeviceLinkage> activeLinkageByVehicleId = new HashMap<>();

        for (DeviceLinkage linkage : linkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (linkage.getVehicle() != null) {
                activeLinkageByVehicleId.putIfAbsent(linkage.getVehicle().getId(), linkage);
            }
        }

        int created = 0;

        for (Policy policy : policyRepository.findAllActive()) {

            Vehicle vehicle = policy.getVehicle();

            if (vehicle == null
                    || vehicle.getDeletedAt() != null
                    || !Boolean.TRUE.equals(vehicle.getActive())) {
                continue;
            }

            // TEMP DEBUG — investigacao pontual do IMEI ausente na placa
            // SOX2I19. Colocado antes de qualquer "continue" (dedup,
            // status fora do alvo) pra sempre logar nessa placa a cada
            // sync, mesmo quando o registro ja existe e o resto da
            // iteracao seria pulado. Remover depois de confirmar a causa.
            if ("SOX2I19".equals(vehicle.getPlate())) {

                DeviceLinkage debugLinkage = activeLinkageByVehicleId.get(vehicle.getId());

                log.info("[LINE-CANCEL] placa={} linkage={} deviceImei={} numberStr={} tracknmeImei={}",
                        vehicle.getPlate(),
                        debugLinkage != null ? debugLinkage.getId() : "null",
                        debugLinkage != null && debugLinkage.getDevice() != null
                                ? debugLinkage.getDevice().getImei() : "null",
                        debugLinkage != null && debugLinkage.getDevice() != null
                                ? debugLinkage.getDevice().getNumberStr() : "null",
                        vehicle.getTracknmeImei());

            }

            PolicyStatus computed = PolicyResponse.computeStatus(policy);

            if (!TARGET_STATUSES.contains(computed)) {
                continue;
            }

            if (policy.getEndDate() == null) {
                // Sem data de fim de vigencia nao da pra contar os dias
                // nem classificar o registro — pula.
                continue;
            }

            if (repository.existsByVehicleAndPolicyEndDate(vehicle, policy.getEndDate())) {
                continue;
            }

            DeviceLinkage linkage = activeLinkageByVehicleId.get(vehicle.getId());
            Device device = linkage != null ? linkage.getDevice() : null;

            // Mesma prioridade ja usada em ReportCustomService: IMEI real
            // do device > numberStr (identificador Multiportal — a
            // planilha de dispositivos costuma vir com IMEI em branco) >
            // IMEI TracknMe do veiculo.
            String imei = null;
            if (device != null) {
                imei = (device.getImei() != null && !device.getImei().isBlank())
                        ? device.getImei()
                        : (device.getNumberStr() != null && !device.getNumberStr().isBlank())
                                ? device.getNumberStr()
                                : null;
            }
            if (imei == null) {
                imei = vehicle.getTracknmeImei();
            }

            LineCancel lineCancel = LineCancel.builder()
                    .vehicle(vehicle)
                    .plate(vehicle.getPlate())
                    .insuredName(policy.getInsuredName() != null
                            ? policy.getInsuredName()
                            : vehicle.getInsuredName())
                    .iccid(device != null ? device.getSerialChip1() : null)
                    .msisdn(device != null ? device.getLineNumber() : null)
                    .imei(imei)
                    .policyEndDate(policy.getEndDate())
                    .policyStatus(computed.name())
                    .status(LineCancelStatus.AGUARDANDO)
                    .build();

            repository.save(lineCancel);

            created++;

        }

        log.info("[LINE-CANCEL] Sync concluido — {} novo(s) registro(s)", created);

        return created;

    }

    // Data usada como referencia pra contar os dias: CANCELLED depende
    // de o usuario informar cancelledAt manualmente (o portal nao avisa
    // quando a operadora de fato desligou a linha); CLOSED/EXPIRED usam
    // policyEndDate direto, que ja vem preenchido do sync.
    private LocalDate referenceDate(LineCancel lc) {

        if ("CANCELLED".equals(lc.getPolicyStatus())) {
            return lc.getCancelledAt();
        }

        return lc.getPolicyEndDate();

    }

    // Mesma regra que referenceDate(LineCancel), so que a partir do DTO
    // ja montado — usada no filtro de periodo/exportacao, que trabalham
    // em cima da lista ja recalculada por findAll().
    private LocalDate referenceDate(LineCancelResponse r) {

        if ("CANCELLED".equals(r.policyStatus())) {
            return r.cancelledAt();
        }

        return r.policyEndDate();

    }

    // So recalcula estados "automaticos" (AGUARDANDO/VERIFICAR/PRONTO) —
    // SOLICITADO/CONCLUIDO sao avancos manuais definitivos, nunca voltam
    // pra tras so' porque os dias desde a data de referencia mudaram.
    void updateStatus(LineCancel lc) {

        if (lc.getStatus() == LineCancelStatus.SOLICITADO
                || lc.getStatus() == LineCancelStatus.CONCLUIDO) {
            return;
        }

        if (lc.getVerifiedAt() != null) {
            lc.setStatus(LineCancelStatus.PRONTO);
            return;
        }

        LocalDate reference = referenceDate(lc);

        if (reference == null) {
            // CANCELLED sem cancelledAt informado ainda — a contagem de
            // dias nem comecou, fica em AGUARDANDO indefinidamente ate
            // alguem preencher a data.
            lc.setStatus(LineCancelStatus.AGUARDANDO);
            return;
        }

        long days = ChronoUnit.DAYS.between(reference, LocalDate.now(ZoneOffset.UTC));

        lc.setStatus(days >= VERIFY_AFTER_DAYS
                ? LineCancelStatus.VERIFICAR
                : LineCancelStatus.AGUARDANDO);

    }

    @Transactional
    public LineCancelResponse setCancelledAt(UUID id, LocalDate cancelledAt) {

        LineCancel lc = findOrThrow(id);

        lc.setCancelledAt(cancelledAt);

        updateStatus(lc);

        repository.save(lc);

        return LineCancelResponse.from(lc);

    }

    @Transactional
    public LineCancelResponse markVerified(UUID id, String user) {

        LineCancel lc = findOrThrow(id);

        lc.setVerifiedAt(LocalDate.now(ZoneOffset.UTC));

        lc.setVerifiedBy(user);

        lc.setStatus(LineCancelStatus.PRONTO);

        repository.save(lc);

        return LineCancelResponse.from(lc);

    }

    @Transactional
    public LineCancelResponse markRequested(UUID id, String user) {

        LineCancel lc = findOrThrow(id);

        lc.setRequestedAt(LocalDate.now(ZoneOffset.UTC));

        lc.setRequestedBy(user);

        lc.setStatus(LineCancelStatus.SOLICITADO);

        repository.save(lc);

        return LineCancelResponse.from(lc);

    }

    @Transactional
    public LineCancelResponse markDone(UUID id) {

        LineCancel lc = findOrThrow(id);

        lc.setStatus(LineCancelStatus.CONCLUIDO);

        repository.save(lc);

        return LineCancelResponse.from(lc);

    }

    public String generateCancelEmail(List<UUID> ids) {

        List<LineCancel> items = repository.findAllById(ids);

        StringBuilder sb = new StringBuilder();

        sb.append("Bom dia, tudo joia?\n\n");
        sb.append("Solicito, por gentileza, o cancelamento das linhas abaixo:\n\n");

        for (LineCancel lc : items) {

            sb.append("ICCID: ").append(valueOrDash(lc.getIccid())).append("\n");
            sb.append("MSISDN: ").append(valueOrDash(lc.getMsisdn())).append("\n");
            sb.append("IMEI: ").append(valueOrDash(lc.getImei())).append("\n\n");

        }

        sb.append("Desde já, agradeço pela atenção e fico no aguardo da confirmação.\n\n");
        sb.append("Atenciosamente,");

        return sb.toString();

    }

    private String valueOrDash(String value) {
        return value != null && !value.isBlank() ? value : "-";
    }

    private String nvl(String value) {
        return value != null ? value : "";
    }

    private LineCancel findOrThrow(UUID id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cancelamento de linha não encontrado"
                ));

    }

    // ==================== EXCEL ====================
    // Mesmo padrao visual (cores/estilos) ja usado em
    // ReportCustomService/TechnicianStockService/MultiportalSheetService.

    private byte[] generateExcel(List<String> headers, List<List<String>> rows) {

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFSheet sheet = workbook.createSheet("Cancelamento de Linhas");

            XSSFColor blue = new XSSFColor(new byte[]{(byte) 0x1d, (byte) 0x4e, (byte) 0xd8}, null);
            XSSFColor navy = new XSSFColor(new byte[]{(byte) 0x1e, (byte) 0x3a, (byte) 0x8a}, null);
            XSSFColor lgray = new XSSFColor(new byte[]{(byte) 0xf3, (byte) 0xf4, (byte) 0xf6}, null);

            XSSFCellStyle titleStyle = workbook.createCellStyle();
            XSSFFont titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 13);
            titleFont.setColor(IndexedColors.WHITE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setFillForegroundColor(blue);
            titleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            titleStyle.setAlignment(HorizontalAlignment.LEFT);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle headerStyle = workbook.createCellStyle();
            XSSFFont headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(navy);
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle evenStyle = workbook.createCellStyle();

            XSSFCellStyle oddStyle = workbook.createCellStyle();
            oddStyle.setFillForegroundColor(lgray);
            oddStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle totalStyle = workbook.createCellStyle();
            XSSFFont totalFont = workbook.createFont();
            totalFont.setBold(true);
            totalStyle.setFont(totalFont);

            int numCols = headers.size();
            String dateStr = LocalDate.now().format(DATE_FMT);
            int rowNum = 0;

            XSSFRow titleRow = sheet.createRow(rowNum++);
            XSSFCell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Cancelamento de Linhas — " + dateStr);
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(titleRow.getRowNum(), titleRow.getRowNum(), 0, Math.max(numCols - 1, 0)));
            titleRow.setHeightInPoints(28);
            rowNum++;

            XSSFRow headerRow = sheet.createRow(rowNum++);
            for (int i = 0; i < headers.size(); i++) {
                XSSFCell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(headerStyle);
            }
            headerRow.setHeightInPoints(18);

            int dataIdx = 0;
            for (List<String> line : rows) {
                XSSFRow row = sheet.createRow(rowNum++);
                XSSFCellStyle rowStyle = dataIdx % 2 == 0 ? evenStyle : oddStyle;
                for (int i = 0; i < line.size(); i++) {
                    XSSFCell cell = row.createCell(i);
                    cell.setCellValue(line.get(i) != null ? line.get(i) : "");
                    cell.setCellStyle(rowStyle);
                }
                dataIdx++;
            }

            XSSFRow totRow = sheet.createRow(rowNum++);
            XSSFCell totCell = totRow.createCell(0);
            totCell.setCellValue("Total: " + rows.size() + " registro(s)");
            totCell.setCellStyle(totalStyle);
            sheet.addMergedRegion(new CellRangeAddress(totRow.getRowNum(), totRow.getRowNum(), 0, Math.max(numCols - 1, 0)));

            for (int i = 0; i < numCols; i++) {
                sheet.setColumnWidth(i, 18 * 256);
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar relatório de cancelamento de linhas (Excel)", e);
        }

    }

    // ==================== PDF ====================
    // OpenPDF (com.lowagie.text.*) — nunca importar com wildcard, colide
    // com java.util.List (com.lowagie.text.List existe).

    private byte[] generatePdf(List<String> headers, List<List<String>> rows) {

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Document document = new Document(PageSize.A4.rotate(), 24, 24, 32, 32);
            PdfWriter.getInstance(document, out);
            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE);
            Font cellFont = FontFactory.getFont(FontFactory.HELVETICA, 7);

            String dateStr = LocalDate.now().format(DATE_FMT);
            Paragraph title = new Paragraph("Cancelamento de Linhas — " + dateStr, titleFont);
            title.setSpacingAfter(10);
            document.add(title);

            PdfPTable table = new PdfPTable(Math.max(headers.size(), 1));
            table.setWidthPercentage(100);

            for (String header : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
                cell.setBackgroundColor(new Color(0x1e, 0x3a, 0x8a));
                cell.setPadding(4);
                table.addCell(cell);
            }

            for (List<String> line : rows) {
                for (String value : line) {
                    PdfPCell cell = new PdfPCell(new Phrase(value != null ? value : "", cellFont));
                    cell.setPadding(3);
                    table.addCell(cell);
                }
            }

            document.add(table);

            Paragraph total = new Paragraph(
                    "Total: " + rows.size() + " registro(s)",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9)
            );
            total.setSpacingBefore(10);
            document.add(total);

            document.close();

            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar relatório de cancelamento de linhas (PDF)", e);
        }

    }

}
