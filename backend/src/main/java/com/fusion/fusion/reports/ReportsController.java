package com.fusion.fusion.reports;

import com.fusion.fusion.importation.ImportDiffLog;
import com.fusion.fusion.importation.ImportDiffLogRepository;
import com.fusion.fusion.importation.ImportType;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportsController {

    private final MultiportalSheetService multiportalSheetService;

    private final TracknMeReportService tracknMeReportService;

    private final ImportDiffLogRepository importDiffLogRepository;

    private static final List<ImportType> FLEET_TYPES =
            List.of(ImportType.MULTIPORTAL_DEVICE, ImportType.MULTIPORTAL_LINKAGE);

    @GetMapping("/fleet-history")
    public List<ImportDiffLog> fleetHistory(
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo) {

        if (dateFrom != null && dateTo != null) {
            LocalDateTime from = LocalDate.parse(dateFrom).atStartOfDay();
            LocalDateTime to   = LocalDate.parse(dateTo).atTime(23, 59, 59);
            return importDiffLogRepository
                    .findByImportTypeInAndCreatedAtBetweenOrderByCreatedAtDesc(FLEET_TYPES, from, to);
        }

        return importDiffLogRepository
                .findByImportTypeInOrderByCreatedAtDesc(FLEET_TYPES);
    }

    @GetMapping("/multiportal-sheet")
    public MultiportalSheetResponse multiportalSheet() {
        return multiportalSheetService.build();
    }

    @GetMapping("/device-report/excel")
    public ResponseEntity<ByteArrayResource> deviceReportExcel() {
        byte[] bytes = multiportalSheetService.generateDeviceReportExcel();
        String filename = "relatorio-dispositivos-"
                + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")) + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

    @GetMapping("/tracknme-report/excel")
    public ResponseEntity<ByteArrayResource> tracknMeReportExcel() {
        byte[] bytes = tracknMeReportService.generateExcel();
        String filename = "relatorio-tracknme-"
                + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")) + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

}
