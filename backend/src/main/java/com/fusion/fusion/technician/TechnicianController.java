package com.fusion.fusion.technician;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
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

    // Chamado pelo bot do WhatsApp (approvalFlow.js, fusion-etl) no
    // comando !aprovar-inst — autenticado por X-ETL-Key, nao por JWT
    // (o bot nao tem usuario logado). Esse endpoint nao tinha consumidor
    // ate agora; se um dia precisar ser chamado tambem pelo navegador,
    // reavaliar (hoje fica so' ETL). Ver permitAll em SecurityConfig.
    @GetMapping("/by-cpf")
    public ResponseEntity<?> findByCpf(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @RequestParam String cpf
    ) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            log.warn("GET /technicians/by-cpf rejeitado: X-ETL-Key inválida ou ausente");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Chave de API inválida"));
        }
        return ResponseEntity.ok(service.findByCpf(cpf));
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
