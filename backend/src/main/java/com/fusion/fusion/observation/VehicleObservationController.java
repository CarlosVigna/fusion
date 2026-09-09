package com.fusion.fusion.observation;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/observations")
@RequiredArgsConstructor
public class VehicleObservationController {

    private final VehicleObservationService service;

    @GetMapping("/vehicle/{plate}")
    public List<VehicleObservationResponse> history(
            @PathVariable String plate
    ) {

        return service.findHistory(plate);

    }

    @PostMapping("/vehicle/{plate}")
    public VehicleObservationResponse create(
            @PathVariable String plate,
            @Valid @RequestBody VehicleObservationRequest request
    ) {

        try {
            return service.create(plate, request.text());
        } catch (Exception e) {
            log.error("[OBSERVATION] Erro ao salvar observação para {}: {}", plate, e.getMessage(), e);
            throw e;
        }

    }

    @PostMapping("/{id}/check")
    public void check(@PathVariable Long id) {

        service.check(id);

    }

    @GetMapping("/latest")
    public Map<String, VehicleObservationResponse> latest() {

        return service.findLatestResponses();

    }

}
