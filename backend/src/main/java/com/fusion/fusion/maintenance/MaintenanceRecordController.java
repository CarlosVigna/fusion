package com.fusion.fusion.maintenance;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/maintenance")
@RequiredArgsConstructor
public class MaintenanceRecordController {

    private final MaintenanceRecordService service;

    @GetMapping
    public List<MaintenanceRecordResponse> findAll(
            @RequestParam(required = false) String status
    ) {

        return service.findAll(
                "ALL".equalsIgnoreCase(status)
        );

    }

    @GetMapping("/overdue")
    public List<MaintenanceRecordResponse> findOverdue() {

        return service.findOverdue();

    }

    @PostMapping
    public MaintenanceRecordResponse create(
            @Valid @RequestBody MaintenanceRecordRequest request
    ) {

        return service.create(request);

    }

    @PutMapping("/{id}")
    public MaintenanceRecordResponse update(
            @PathVariable Long id,
            @Valid @RequestBody MaintenanceRecordRequest request
    ) {

        return service.update(id, request);

    }

    @PutMapping("/{id}/close")
    public MaintenanceRecordResponse close(
            @PathVariable Long id
    ) {

        return service.close(id);

    }

    @PutMapping("/{id}/baixar")
    public MaintenanceRecordResponse baixar(
            @PathVariable Long id
    ) {

        return service.baixar(id);

    }

    @PutMapping("/{id}/prorrogar")
    public MaintenanceRecordResponse prorrogar(
            @PathVariable Long id,
            @RequestBody ProrrogarRequest request
    ) {

        return service.prorrogar(id, request.novoPrazo());

    }

    @PutMapping("/{id}/reativar")
    public MaintenanceRecordResponse reativar(
            @PathVariable Long id
    ) {

        return service.reativar(id);

    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {

        service.delete(id);

    }

}
