package com.fusion.fusion.importation;

import com.fusion.fusion.importation.orchestrator.ImportOrchestratorService;
import com.fusion.fusion.vehicle.multiportal.operational.MultiportalOperationalService;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalUpdateRequest;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalUpdateResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
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

    @Value("${fusion.etl.server-url}")
    private String etlServerUrl;

    private static final HttpClient HTTP_CLIENT =
            HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();

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

        new Thread(() -> {

            try {

                triggerScrapeIfApplicable(type);

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

    private void triggerScrapeIfApplicable(ImportType type) {

        if (type == null) {
            return; // reprocessa só o que já está em pending/
        }

        String scrapeEndpoint = switch (type) {
            case MULTIPORTAL_DEVICE -> "/scrape/device";
            case MULTIPORTAL_LINKAGE -> "/scrape/linkage";
            case MULTIPORTAL_OPERATIONAL -> "/scrape/operational";
            default -> null;
        };

        if (scrapeEndpoint == null) {
            return; // sem type, ou TRACKNME: só reprocessa pending/
        }

        try {

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(etlServerUrl + scrapeEndpoint))
                    .timeout(Duration.ofSeconds(120))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            log.info(
                    "Scraper ETL ({}) respondeu {}: {}",
                    type,
                    response.statusCode(),
                    response.body()
            );

        } catch (Exception e) {

            log.error(
                    "Não foi possível acionar o scraper ETL para {} — "
                            + "seguindo apenas com reprocessamento de imports/pending",
                    type,
                    e
            );

        }

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
