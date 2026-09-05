package com.fusion.fusion.linecancel;

import com.fusion.fusion.common.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/line-cancels")
@RequiredArgsConstructor
public class LineCancelController {

    private final LineCancelService service;

    private final CurrentUserService currentUserService;

    @GetMapping
    public List<LineCancelResponse> findAll(
            @RequestParam(required = false) LineCancelStatus status
    ) {

        return service.findAll(status);

    }

    @PostMapping("/sync")
    public Map<String, Integer> sync() {

        int created = service.syncFromPolicies();

        return Map.of("created", created);

    }

    @PutMapping("/{id}/verify")
    public LineCancelResponse verify(@PathVariable UUID id) {

        return service.markVerified(id, currentUserService.getCurrentUserName());

    }

    @PutMapping("/{id}/request")
    public LineCancelResponse request(@PathVariable UUID id) {

        return service.markRequested(id, currentUserService.getCurrentUserName());

    }

    @PutMapping("/{id}/done")
    public LineCancelResponse done(@PathVariable UUID id) {

        return service.markDone(id);

    }

    @PutMapping("/{id}/set-date")
    public LineCancelResponse setDate(
            @PathVariable UUID id,
            @RequestBody LineCancelSetDateRequest request
    ) {

        return service.setCancelledAt(id, request.cancelledAt());

    }

    @PostMapping("/email")
    public Map<String, String> email(@RequestBody LineCancelEmailRequest request) {

        return Map.of("text", service.generateCancelEmail(request.ids()));

    }

    // Aba Aguardando nao usa esse endpoint (sem filtro/exportacao, ver
    // LineCancels.jsx) — so Verificar/Pronto/Solicitado/Concluidas.
    @GetMapping("/export")
    public ResponseEntity<ByteArrayResource> export(
            @RequestParam String format,
            @RequestParam(required = false) LineCancelStatus status,
            @RequestParam(required = false) String plate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo
    ) {

        byte[] bytes = service.exportFiltered(status, plate, dateFrom, dateTo, format);

        boolean isPdf = "PDF".equalsIgnoreCase(format);

        String filename = "cancelamento-linhas." + (isPdf ? "pdf" : "xlsx");

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
