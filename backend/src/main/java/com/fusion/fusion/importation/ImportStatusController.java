package com.fusion.fusion.importation;

import com.fusion.fusion.etl.EtlTriggerService;
import com.fusion.fusion.importation.orchestrator.ImportOrchestratorService;
import com.fusion.fusion.operational.engine.EngineAsyncService;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    private final EtlTriggerService etlTriggerService;

    private final EngineAsyncService engineAsyncService;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

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

    // O backend nao chama mais o ETL diretamente (ele esta atras de NAT,
    // inalcancavel sem tunel) — so enfileira o pedido. O ETL local
    // reivindica via GET /etl/poll, roda o scraper, e entrega o
    // resultado por /imports/upload, como ja fazia. O Grid se atualiza
    // sozinho via o evento GRID_UPDATED (WebSocket) quando o import
    // terminar — por isso a resposta aqui e' imediata, sem esperar
    // o scrape de fato rodar.
    @PostMapping("/trigger")
    public ResponseEntity<Map<String, String>> trigger(
            @RequestParam(required = false) ImportType type
    ) {

        try {

            if (type != null) {
                etlTriggerService.request(type);
            }

            orchestratorService.execute();

            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "message", type != null
                            ? "Atualização solicitada — o ETL vai processar em breve"
                            : "Reprocessamento de imports/pending concluído"
            ));

        } catch (Exception e) {

            log.error("Erro ao solicitar atualização/reprocessar imports para {}", type, e);

            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "status", "ERROR",
                    "message", "Falha ao solicitar atualização: " + e.getMessage()
            ));

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
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @AuthenticationPrincipal UserDetails currentUser
    ) {

        boolean validEtlKey = etlApiKey != null
                && !etlApiKey.isBlank()
                && etlApiKey.equals(providedKey);

        boolean jwtAuthenticated = currentUser != null;

        if (!validEtlKey && !jwtAuthenticated) {

            log.warn(
                    "Upload de import rejeitado: sem autenticação válida (X-ETL-Key ou JWT)"
            );

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "status", "ERROR",
                            "message", "Autenticação inválida"
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

                case MULTIPORTAL_OPERATIONAL, MULTIPORTAL_ULTIMA_POSICAO -> {

                    Object result = operationalImportService.importFile(file);

                    // Dispara o motor em thread @Async — contexto transacional
                    // completamente novo, sem herdar rollback-only do importFile.
                    engineAsyncService.runAfterImport();

                    yield result;

                }

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
