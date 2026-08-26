package com.fusion.fusion.vehicle.portal;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/vehicles/sync-portal")
@RequiredArgsConstructor
public class VehiclePortalSyncController {

    private final VehiclePortalSyncService service;

    @PostMapping
    public Map<String, String> startSync() {
        return Map.of("jobId", service.startAsync());
    }

    @GetMapping("/status/{jobId}")
    public VehiclePortalSyncJob status(@PathVariable String jobId) {
        return service.getStatus(jobId);
    }

    @GetMapping("/diffs")
    public List<VehiclePortalDiffResponse> diffs() {
        return service.findPendingDiffs();
    }

    @PutMapping("/diffs/{id}/accept")
    public VehiclePortalDiffResponse accept(@PathVariable Long id) {
        return service.accept(id);
    }

    @PutMapping("/diffs/{id}/reject")
    public VehiclePortalDiffResponse reject(@PathVariable Long id) {
        return service.reject(id);
    }

    @PutMapping("/diffs/accept-all")
    public Map<String, Integer> acceptAll() {
        return Map.of("accepted", service.acceptAll());
    }

}
