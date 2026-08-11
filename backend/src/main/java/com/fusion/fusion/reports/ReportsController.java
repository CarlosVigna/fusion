package com.fusion.fusion.reports;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportsController {

    private final MultiportalSheetService multiportalSheetService;

    private final TracknMeReportService tracknMeReportService;

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
