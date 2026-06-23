package com.fusion.fusion.observation;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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

        return service.create(plate, request.text());

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
