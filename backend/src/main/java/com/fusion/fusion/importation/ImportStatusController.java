package com.fusion.fusion.importation;

import com.fusion.fusion.importation.orchestrator.ImportOrchestratorService;
import com.fusion.fusion.vehicle.multiportal.device.DeviceImportService;
import com.fusion.fusion.vehicle.multiportal.linkage.LinkageImportService;
import com.fusion.fusion.vehicle.multiportal.operational.MultiportalOperationalService;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalListImportService;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalUpdateRequest;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalUpdateResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/imports")
@RequiredArgsConstructor
public class ImportStatusController {

    private final ImportHistoryRepository repository;

    private final ImportOrchestratorService orchestratorService;

    private final MultiportalOperationalService operationalService;

    private final OperationalListImportService operationalImportService;

    private final DeviceImportService deviceImportService;

    private final LinkageImportService linkageImportService;

    @Value("${fusion.etl.server-url}")
    private String etlServerUrl;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

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
    public ResponseEntity<Map<String, String>> trigger(
            @RequestParam(required = false) ImportType type
    ) {

        try {

            triggerScrapeIfApplicable(type);

            orchestratorService.execute();

            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "message", "Reprocessamento de imports/pending concluído"
            ));

        } catch (Exception e) {

            log.error("Erro ao acionar scraper/reprocessar imports para {}", type, e);

            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "status", "ERROR",
                    "message", "Falha ao acionar o ETL: " + e.getMessage()
            ));

        }

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

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(etlServerUrl + scrapeEndpoint))
                .timeout(Duration.ofSeconds(120))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<String> response;

        try {

            response = HTTP_CLIENT.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

        } catch (Exception e) {

            throw new RuntimeException(
                    "Não foi possível conectar ao ETL em " + etlServerUrl,
                    e
            );

        }

        log.info(
                "Scraper ETL ({}) respondeu {}: {}",
                type,
                response.statusCode(),
                response.body()
        );

        if (response.statusCode() != 200) {

            throw new RuntimeException(
                    "Scraper ETL para " + type + " falhou: " + response.body()
            );

        }

    }

    // Endpoint M2M usado pelo ETL local para entregar o XLS quando o
    // backend roda na nuvem (Render) e nao compartilha mais o sistema de
    // arquivos com o PC do ETL — sem isso, o orquestrador (que so escaneia
    // a pasta pending/ local) nunca veria o arquivo. Autenticado por
    // API key (X-ETL-Key), nao por JWT — o ETL nao tem usuario logado.
    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") String type,
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey
    ) {

        if (etlApiKey == null
                || etlApiKey.isBlank()
                || !etlApiKey.equals(providedKey)) {

            log.warn(
                    "Upload de import rejeitado: chave X-ETL-Key inválida ou ausente"
            );

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "status", "ERROR",
                            "message", "Chave de API inválida"
                    ));

        }

        ImportType importType;

        try {

            importType = ImportType.valueOf(type);

        } catch (IllegalArgumentException e) {

            return ResponseEntity.badRequest().body(Map.of(
                    "status", "ERROR",
                    "message", "Tipo de import inválido: " + type
            ));

        }

        try {

            Object response = switch (importType) {

                case MULTIPORTAL_OPERATIONAL ->
                        operationalImportService.importFile(file);

                case MULTIPORTAL_DEVICE ->
                        deviceImportService.importFile(file);

                case MULTIPORTAL_LINKAGE ->
                        linkageImportService.importFile(file);

                case TRACKNME -> {
                    throw new IllegalArgumentException(
                            "Upload de TRACKNME não é suportado neste endpoint"
                    );
                }

            };

            log.info(
                    "Upload via ETL processado com sucesso: type={} file={}",
                    importType,
                    file.getOriginalFilename()
            );

            return ResponseEntity.ok(response);

        } catch (Exception e) {

            log.error(
                    "Erro ao processar upload do ETL (type={}, file={})",
                    importType,
                    file.getOriginalFilename(),
                    e
            );

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "status", "ERROR",
                            "message", Objects.requireNonNullElse(
                                    e.getMessage(),
                                    e.getClass().getSimpleName()
                            )
                    ));

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
