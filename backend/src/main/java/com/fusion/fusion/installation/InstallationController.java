package com.fusion.fusion.installation;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/installations")
@RequiredArgsConstructor
public class InstallationController {

    private final InstallationService service;

    @GetMapping
    public List<InstallationResponse> findAll(
            @RequestParam(required = false) String status
    ) {
        return service.findAll(status);
    }

    @GetMapping("/pending-count")
    public Map<String, Long> pendingCount() {
        return Map.of("count", service.countPending());
    }

    @PostMapping
    public InstallationResponse create(
            @RequestBody InstallationRequest request
    ) {
        return service.create(request);
    }

    @PutMapping("/{id}/sent")
    public InstallationResponse markSent(@PathVariable Long id) {
        return service.markSent(id);
    }

    @PutMapping("/{id}/cancel")
    public InstallationResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

}
