package com.fusion.fusion.stock;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/stock")
@RequiredArgsConstructor
public class TechnicianStockController {

    private final TechnicianStockService service;

    @GetMapping
    public List<TechnicianStockResponse> findAll() {
        return service.findAll();
    }

    @GetMapping("/technician/{id}")
    public List<TechnicianStockResponse> findByTechnician(@PathVariable UUID id) {
        return service.findByTechnician(id);
    }

    @PostMapping("/technician/{id}")
    public TechnicianStockResponse addToStock(
            @PathVariable UUID id,
            @RequestBody StockRequest request
    ) {
        return service.addToStock(id, request);
    }

    @PutMapping("/{id}/confirm")
    public TechnicianStockResponse confirmInstallation(
            @PathVariable Long id,
            @RequestBody ConfirmInstallationRequest request
    ) {
        return service.confirmInstallation(id, request.plate(), request.installedAt());
    }

    @PutMapping("/{id}/return")
    public TechnicianStockResponse markAsReturned(@PathVariable Long id) {
        return service.markAsReturned(id);
    }

    @GetMapping("/check-imei")
    public Map<String, Object> checkImei(@RequestParam String imei) {
        return service.checkImei(imei);
    }

    @GetMapping("/pending-confirmation")
    public List<StockPendingConfirmationResponse> pendingConfirmations() {
        return service.findPendingConfirmations();
    }

    @PutMapping("/pending-confirmation/{id}/ignore")
    public void ignorePendingConfirmation(@PathVariable Long id) {
        service.dismissPendingConfirmation(id);
    }

    @GetMapping("/export")
    public ResponseEntity<ByteArrayResource> exportExcel() {
        byte[] bytes = service.exportExcel();
        String filename = "estoque-equipamentos-"
                + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")) + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

}
