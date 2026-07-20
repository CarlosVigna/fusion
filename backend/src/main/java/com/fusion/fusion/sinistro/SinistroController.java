package com.fusion.fusion.sinistro;

import com.fusion.fusion.common.security.CurrentUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/sinistro")
@RequiredArgsConstructor
public class SinistroController {

    private final SinistroAnalysisService service;
    private final SinistroReportFileService reportFileService;
    private final CurrentUserService currentUserService;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

    @PostMapping("/start")
    public SinistroStartResponse start(@Valid @RequestBody SinistroStartRequest request) {

        return service.start(request, currentUserService.getCurrentUserName());

    }

    @GetMapping("/{id}/status")
    public SinistroStatusResponse status(@PathVariable UUID id) {

        return service.getStatus(id);

    }

    @GetMapping("/history")
    public List<SinistroHistoryResponse> history() {

        return service.getHistory();

    }

    // Endpoint M2M usado pelo ETL local para entregar os XLS baixados do
    // Multiportal — mesmo padrao de autenticacao (X-ETL-Key) usado em
    // /imports/upload, ja que o ETL nao tem usuario logado.
    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("sinistroId") UUID sinistroId,
            @RequestParam(value = "kmMensalFile", required = false) MultipartFile kmMensalFile,
            @RequestParam(value = "speedFiles", required = false) List<MultipartFile> speedFiles,
            @RequestParam(value = "ignicaoFile", required = false) MultipartFile ignicaoFile,
            @RequestParam(value = "status", defaultValue = "SUCCESS") String status,
            @RequestParam(value = "error", required = false) String error,
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey
    ) {

        if (!isValidEtlKey(providedKey)) {

            log.warn("Upload de análise de sinistro rejeitado: X-ETL-Key inválida ou ausente");

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("status", "ERROR", "message", "Chave de API inválida"));

        }

        try {

            service.receiveUpload(sinistroId, kmMensalFile, speedFiles, ignicaoFile, status, error);

            return ResponseEntity.ok(Map.of("status", "OK"));

        } catch (Exception e) {

            log.error("Erro ao processar upload da análise de sinistro {}", sinistroId, e);

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "ERROR", "message", e.getMessage()));

        }

    }

    @GetMapping("/{id}/download-report")
    public ResponseEntity<byte[]> downloadReport(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "xlsx") String format
    ) throws IOException {

        SinistroStatusResponse status = service.getStatus(id);

        if ("pdf".equalsIgnoreCase(format)) {

            byte[] pdf = reportFileService.buildPdfReport(status);

            return fileResponse(pdf, "relatorio-sinistro-" + status.plate() + ".pdf", MediaType.APPLICATION_PDF);

        }

        byte[] excel = reportFileService.buildExcelReport(status);

        return fileResponse(
                excel,
                "relatorio-sinistro-" + status.plate() + ".xlsx",
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        );

    }

    @GetMapping("/{id}/download-pack")
    public ResponseEntity<byte[]> downloadPack(@PathVariable UUID id) throws IOException {

        SinistroStatusResponse status = service.getStatus(id);
        Path analysisDir = service.resolveAnalysisDir(id);

        byte[] zip = reportFileService.buildPack(analysisDir, status);

        return fileResponse(
                zip,
                "sinistro-" + status.plate() + "-pack.zip",
                MediaType.parseMediaType("application/zip")
        );

    }

    private boolean isValidEtlKey(String providedKey) {
        return etlApiKey != null && !etlApiKey.isBlank() && etlApiKey.equals(providedKey);
    }

    private ResponseEntity<byte[]> fileResponse(byte[] content, String filename, MediaType mediaType) {

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(content);

    }

}
