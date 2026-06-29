package com.fusion.fusion.maintenance;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

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

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {

        service.delete(id);

    }

}
