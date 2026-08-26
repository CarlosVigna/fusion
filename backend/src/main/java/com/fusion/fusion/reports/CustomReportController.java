package com.fusion.fusion.reports;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/reports/custom")
@RequiredArgsConstructor
public class CustomReportController {

    private final ReportCustomService service;

    @PostMapping("/count")
    public Map<String, Integer> count(@RequestBody CustomReportRequest request) {
        return Map.of("count", service.countMatching(request.filters()));
    }

    @PostMapping
    public ResponseEntity<ByteArrayResource> generate(@RequestBody CustomReportRequest request) {

        byte[] bytes = service.generate(request);

        boolean isPdf = "PDF".equalsIgnoreCase(request.format());

        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        String filename = "relatorio-personalizado-" + dateStr + (isPdf ? ".pdf" : ".xlsx");

        MediaType mediaType = isPdf
                ? MediaType.APPLICATION_PDF
                : MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(mediaType)
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));

    }

}
