package com.fusion.fusion.setup;

import com.fusion.fusion.policy.EtlPolicyResult;
import com.fusion.fusion.policy.Policy;
import com.fusion.fusion.policy.PolicyRepository;
import com.fusion.fusion.policy.PolicyResponse;
import com.fusion.fusion.policy.PolicyService;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

// Auditoria completa da frota — 1 planilha com 4 abas (Apolices,
// Veiculos, Dispositivos e Vinculos, Posicionamento), cada veiculo
// ativo/nao-TEST comparado banco vs portal/vinculo/sinal. Usada pelo
// GET /setup/full-audit, chamada manual e pontual — sincrona de
// proposito, mesmo padrao ja aceito em POST /setup/fix-expired-
// policies-portal (tambem faz 1 fetchFromPortal() por veiculo, mesma
// natureza "ferramenta de admin", nao fluxo de producao em volume).
@Slf4j
@Service
@RequiredArgsConstructor
public class FullAuditService {

    private final VehicleRepository vehicleRepository;

    private final PolicyRepository policyRepository;

    private final PolicyService policyService;

    private final DeviceLinkageRepository deviceLinkageRepository;

    private final VehicleOperationalStateRepository operationalStateRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // Vermelho = problema concreto (nao achou, sem vinculo, sinal
    // critico); amarelo = precisa de revisao mas nao e' necessariamente
    // um erro (divergencia de dado, campo vazio, atraso moderado).
    private static final Set<String> RED_RESULTS = Set.of("NÃO ENCONTRADO", "SEM VÍNCULO", "CRÍTICO");

    private static final Set<String> YELLOW_RESULTS = Set.of("DIVERGENTE", "CAMPO VAZIO", "ATENÇÃO");

    public byte[] generate() {

        List<Vehicle> vehicles = vehicleRepository.findAll().stream()
                .filter(v -> v.getDeletedAt() == null)
                .filter(v -> Boolean.TRUE.equals(v.getActive()))
                .filter(v -> v.getVehicleGroup() != VehicleGroup.TEST)
                .sorted(Comparator.comparing(Vehicle::getPlate, String.CASE_INSENSITIVE_ORDER))
                .toList();

        Map<UUID, Policy> bestPolicyByVehicleId = policyRepository.findAllActiveWithVehicle().stream()
                .filter(p -> p.getVehicle() != null)
                .collect(Collectors.toMap(
                        p -> p.getVehicle().getId(),
                        p -> p,
                        PolicyService::pickBestPolicy
                ));

        Map<UUID, DeviceLinkage> linkageByVehicleId = deviceLinkageRepository.findAllActiveWithVehicleAndDevice().stream()
                .filter(l -> l.getVehicle() != null)
                .collect(Collectors.toMap(
                        l -> l.getVehicle().getId(),
                        l -> l,
                        (a, b) -> a
                ));

        Map<UUID, VehicleOperationalState> stateByVehicleId = operationalStateRepository.findAllWithVehicle().stream()
                .filter(s -> s.getVehicle() != null)
                .collect(Collectors.toMap(
                        s -> s.getVehicle().getId(),
                        s -> s,
                        (a, b) -> a
                ));

        List<List<String>> policyRows = new ArrayList<>();
        List<List<String>> vehicleRows = new ArrayList<>();

        for (Vehicle vehicle : vehicles) {

            Policy dbPolicy = bestPolicyByVehicleId.get(vehicle.getId());

            EtlPolicyResult portalResult;
            try {
                portalResult = policyService.fetchFromPortal(vehicle.getPlate());
            } catch (Exception e) {
                log.warn("[FULL-AUDIT] Falha ao consultar portal pra placa={}: {} — {}",
                        vehicle.getPlate(), e.getClass().getSimpleName(), e.getMessage());
                portalResult = new EtlPolicyResult(false, null);
            }

            policyRows.add(buildPolicyRow(vehicle, dbPolicy, portalResult));
            vehicleRows.add(buildVehicleRow(vehicle, portalResult));

        }

        List<List<String>> deviceRows = vehicles.stream()
                .map(v -> buildDeviceRow(v, linkageByVehicleId.get(v.getId())))
                .toList();

        List<List<String>> positionRows = vehicles.stream()
                .map(v -> buildPositionRow(v, stateByVehicleId.get(v.getId())))
                .toList();

        return buildWorkbook(
                new SheetData(
                        "Apólices",
                        List.of(
                                "Placa", "Segurado Banco", "Segurado Portal", "Apólice Banco", "Apólice Portal",
                                "Início Banco", "Início Portal", "Fim Banco", "Fim Portal",
                                "Status Banco", "Status Portal", "Resultado"
                        ),
                        policyRows
                ),
                new SheetData(
                        "Veículos",
                        List.of(
                                "Placa", "Marca Banco", "Marca Portal", "Modelo Banco", "Modelo Portal",
                                "CPF Banco", "CPF Portal", "Resultado"
                        ),
                        vehicleRows
                ),
                new SheetData(
                        "Dispositivos e Vínculos",
                        List.of("Placa", "Tem Vínculo", "IMEI", "Linha", "Operadora", "Modelo Dispositivo", "Resultado"),
                        deviceRows
                ),
                new SheetData(
                        "Posicionamento",
                        List.of("Placa", "Última Comunicação", "Dias Sem Sinal", "Status"),
                        positionRows
                )
        );

    }

    private List<String> buildPolicyRow(Vehicle vehicle, Policy dbPolicy, EtlPolicyResult portalResult) {

        boolean portalFound = portalResult.found() && portalResult.data() != null;
        EtlPolicyResult.EtlPolicyData portal = portalFound ? portalResult.data() : null;

        String dbInsured = dbPolicy != null ? dbPolicy.getInsuredName() : vehicle.getInsuredName();
        String dbNumber  = dbPolicy != null ? dbPolicy.getPolicyNumber() : null;
        String dbStart   = dbPolicy != null ? isoOrDash(dbPolicy.getStartDate()) : "--";
        String dbEnd     = dbPolicy != null ? isoOrDash(dbPolicy.getEndDate()) : "--";
        String dbStatus  = dbPolicy != null ? PolicyResponse.computeStatus(dbPolicy).name() : "SEM APÓLICE";

        String portalInsured = portalFound ? portal.insuredName() : null;
        String portalNumber  = portalFound ? portal.policyNumber() : null;
        String portalStart   = portalFound ? portalDateOrDash(portal.startDate()) : "--";
        String portalEnd     = portalFound ? portalDateOrDash(portal.endDate()) : "--";
        String portalStatus  = portalFound ? portal.statusDescricao() : null;

        String resultado;

        if (!portalFound) {

            resultado = "NÃO ENCONTRADO";

        } else if (dbPolicy == null) {

            resultado = "DIVERGENTE";

        } else {

            LocalDate portalEndDate = portal.endDate() != null && !portal.endDate().isBlank()
                    ? LocalDate.parse(portal.endDate())
                    : null;

            boolean same = Objects.equals(dbNumber, portalNumber)
                    && Objects.equals(dbPolicy.getEndDate(), portalEndDate);

            resultado = same ? "OK" : "DIVERGENTE";

        }

        return list(
                vehicle.getPlate(), nvl(dbInsured), nvl(portalInsured),
                nvl(dbNumber), nvl(portalNumber),
                dbStart, portalStart, dbEnd, portalEnd,
                dbStatus, nvl(portalStatus), resultado
        );

    }

    private List<String> buildVehicleRow(Vehicle vehicle, EtlPolicyResult portalResult) {

        boolean portalFound = portalResult.found() && portalResult.data() != null;
        EtlPolicyResult.EtlPolicyData portal = portalFound ? portalResult.data() : null;

        String dbBrand = vehicle.getVehicleBrand();
        String dbModel = vehicle.getVehicleModel();
        String dbCpf   = vehicle.getCpfCnpj();

        String portalBrand = portalFound ? portal.vehicleBrand() : null;
        String portalModel = portalFound ? portal.vehicleModel() : null;
        String portalCpf   = portalFound ? portal.cpfCnpj() : null;

        String resultado;

        if (!portalFound) {
            resultado = "NÃO ENCONTRADO";
        } else {
            boolean same = equalsNormalized(dbBrand, portalBrand)
                    && equalsNormalized(dbModel, portalModel)
                    && equalsNormalized(dbCpf, portalCpf);
            resultado = same ? "OK" : "DIVERGENTE";
        }

        return list(
                vehicle.getPlate(),
                nvl(dbBrand), nvl(portalBrand),
                nvl(dbModel), nvl(portalModel),
                nvl(dbCpf), nvl(portalCpf),
                resultado
        );

    }

    private List<String> buildDeviceRow(Vehicle vehicle, DeviceLinkage linkage) {

        if (linkage == null || linkage.getDevice() == null) {
            return list(vehicle.getPlate(), "Não", "--", "--", "--", "--", "SEM VÍNCULO");
        }

        Device device = linkage.getDevice();

        String imei      = device.getImei();
        String linha      = device.getLineNumber();
        String operadora  = device.getOperator();
        String modelo     = device.getModel();

        boolean anyBlank = isBlank(imei) || isBlank(linha) || isBlank(operadora) || isBlank(modelo);

        String resultado = anyBlank ? "CAMPO VAZIO" : "OK";

        return list(vehicle.getPlate(), "Sim", nvl(imei), nvl(linha), nvl(operadora), nvl(modelo), resultado);

    }

    private List<String> buildPositionRow(Vehicle vehicle, VehicleOperationalState state) {

        LocalDateTime lastComm = state != null ? state.getLastCommunicationAt() : null;

        if (lastComm == null) {
            return list(vehicle.getPlate(), "Nunca comunicou", "--", "CRÍTICO");
        }

        long hours = ChronoUnit.HOURS.between(lastComm, LocalDateTime.now(ZoneOffset.UTC));

        String status = hours < 24 ? "OK" : hours <= 72 ? "ATENÇÃO" : "CRÍTICO";

        return list(
                vehicle.getPlate(),
                lastComm.format(DATETIME_FMT),
                String.format(Locale.ROOT, "%.1f", hours / 24.0),
                status
        );

    }

    private record SheetData(String name, List<String> headers, List<List<String>> rows) {}

    private byte[] buildWorkbook(SheetData... sheets) {

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFColor navy = new XSSFColor(new byte[]{(byte) 0x1e, (byte) 0x3a, (byte) 0x8a}, null);
            XSSFColor lightRed = new XSSFColor(new byte[]{(byte) 0xfe, (byte) 0xe2, (byte) 0xe2}, null);
            XSSFColor lightYellow = new XSSFColor(new byte[]{(byte) 0xfe, (byte) 0xf9, (byte) 0xc3}, null);

            XSSFCellStyle headerStyle = workbook.createCellStyle();
            XSSFFont headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(navy);
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle normalStyle = workbook.createCellStyle();

            XSSFCellStyle redStyle = workbook.createCellStyle();
            redStyle.setFillForegroundColor(lightRed);
            redStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle yellowStyle = workbook.createCellStyle();
            yellowStyle.setFillForegroundColor(lightYellow);
            yellowStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            for (SheetData sheet : sheets) {

                XSSFSheet xsheet = workbook.createSheet(sheet.name());

                XSSFRow headerRow = xsheet.createRow(0);
                for (int i = 0; i < sheet.headers().size(); i++) {
                    XSSFCell cell = headerRow.createCell(i);
                    cell.setCellValue(sheet.headers().get(i));
                    cell.setCellStyle(headerStyle);
                }

                int rowNum = 1;
                for (List<String> rowData : sheet.rows()) {

                    String resultado = rowData.get(rowData.size() - 1);

                    XSSFCellStyle rowStyle = RED_RESULTS.contains(resultado)
                            ? redStyle
                            : YELLOW_RESULTS.contains(resultado)
                                    ? yellowStyle
                                    : normalStyle;

                    XSSFRow row = xsheet.createRow(rowNum++);
                    for (int i = 0; i < rowData.size(); i++) {
                        XSSFCell cell = row.createCell(i);
                        cell.setCellValue(rowData.get(i));
                        cell.setCellStyle(rowStyle);
                    }

                }

                for (int i = 0; i < sheet.headers().size(); i++) {
                    xsheet.setColumnWidth(i, 20 * 256);
                }

                xsheet.createFreezePane(0, 1);

            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar auditoria completa (Excel)", e);
        }

    }

    private static String nvl(String value) {
        return value != null && !value.isBlank() ? value : "--";
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean equalsNormalized(String a, String b) {
        String na = a != null ? a.trim().toUpperCase(Locale.ROOT) : "";
        String nb = b != null ? b.trim().toUpperCase(Locale.ROOT) : "";
        return na.equals(nb);
    }

    private static String isoOrDash(LocalDate date) {
        return date != null ? date.format(DATE_FMT) : "--";
    }

    private static String portalDateOrDash(String isoDate) {

        if (isoDate == null || isoDate.isBlank()) {
            return "--";
        }

        try {
            return LocalDate.parse(isoDate).format(DATE_FMT);
        } catch (Exception e) {
            return isoDate;
        }

    }

    private static List<String> list(String... values) {
        return Arrays.asList(values);
    }

}
