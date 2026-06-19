package com.fusion.fusion.importation;

import com.fusion.fusion.importation.orchestrator.ImportOrchestratorService;
import com.fusion.fusion.vehicle.multiportal.operational.MultiportalOperationalService;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalUpdateRequest;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalUpdateResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/imports")
@RequiredArgsConstructor
public class ImportStatusController {

    private final ImportHistoryRepository repository;

    private final ImportOrchestratorService orchestratorService;

    private final MultiportalOperationalService operationalService;

    @GetMapping("/last-sync")
    public LastSyncResponse lastSync(
            @RequestParam(required = false) ImportType type
    ) {

        Optional<ImportHistory> history = type != null
                ? repository.findTopByTypeAndStatusOrderByCreatedAtDesc(
                        type,
                        ImportStatus.SUCCESS
                )
                : repository.findTopByStatusOrderByCreatedAtDesc(
                        ImportStatus.SUCCESS
                );

        return history
                .map(h -> new LastSyncResponse(
                        h.getCreatedAt(),
                        h.getType(),
                        h.getStatus()
                ))
                .orElse(new LastSyncResponse(null, type, null));

    }

    @PostMapping("/trigger")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> trigger(
            @RequestParam(required = false) ImportType type
    ) {

        // Reprocessa imediatamente qualquer arquivo já presente em
        // imports/pending, em vez de esperar o próximo ciclo agendado.
        // Acionar o scraper Playwright diretamente a partir do backend
        // fica para uma integração futura.
        new Thread(() -> {

            try {

                orchestratorService.execute();

            } catch (Exception e) {

                log.error("Erro ao reprocessar imports/pending", e);

            }

        }).start();

        return Map.of(
                "status", "ACCEPTED",
                "message", "Reprocessamento de imports/pending iniciado"
        );

    }

    @PostMapping("/paste/ultima-posicao")
    public OperationalUpdateResponse pasteUltimaPosicao(
            @Valid @RequestBody PasteImportRequest request
    ) {

        return operationalService.update(
                new OperationalUpdateRequest(request.content())
        );

    }

}
