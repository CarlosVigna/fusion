package com.fusion.fusion.technician;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/technicians")
@RequiredArgsConstructor
public class TechnicianController {

    private final TechnicianService service;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

    @GetMapping
    public List<TechnicianResponse> listAll() {
        return service.listAll();
    }

    @GetMapping("/by-cpf")
    public ResponseEntity<?> findByCpf(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @RequestParam String cpf) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Chave de API inválida"));
        }
        // TechnicianService.findByCpf já normaliza o CPF internamente
        try {
            return ResponseEntity.ok(service.findByCpf(cpf));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TechnicianResponse create(@RequestBody TechnicianRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public TechnicianResponse update(@PathVariable UUID id, @RequestBody TechnicianRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
