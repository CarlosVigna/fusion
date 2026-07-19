package com.fusion.fusion.sinistro;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.importation.storage.config.ImportStorageProperties;
import com.fusion.fusion.vehicle.PlateNormalizer;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SinistroAnalysisService {

    private final SinistroAnalysisRepository repository;
    private final VehicleRepository vehicleRepository;
    private final SinistroKmParserService kmParserService;
    private final SinistroSpeedParserService speedParserService;
    private final SinistroIndicatorService indicatorService;
    private final ImportStorageProperties storageProperties;
    private final ObjectMapper objectMapper;

    @Transactional
    public SinistroStartResponse start(SinistroStartRequest request, String createdBy) {

        String plate = PlateNormalizer.normalize(request.plate());

        String insuredName = vehicleRepository.findByPlate(plate)
                .map(Vehicle::getInsuredName)
                .orElse(null);

        SinistroAnalysis analysis = SinistroAnalysis.builder()
                .plate(plate)
                .insuredName(insuredName)
                .startDate(request.startDate())
                .endDate(request.endDate())
                .sinistroDate(request.sinistroDate())
                .sinistroTime(request.sinistroTime())
                .sinistroType(request.sinistroType())
                .status(SinistroStatus.PENDING)
                .createdBy(createdBy)
                .build();

        repository.save(analysis);

        return new SinistroStartResponse(analysis.getId(), analysis.getStatus());

    }

    // Chamado por GET /etl/poll — reivindica a analise PENDING mais
    // antiga, se existir, marcando RUNNING antes de devolver ao ETL.
    @Transactional
    public Optional<SinistroJobPayload> claimNextPending() {

        return repository.findFirstByStatusOrderByCreatedAtAsc(SinistroStatus.PENDING)
                .map(analysis -> {

                    analysis.setStatus(SinistroStatus.RUNNING);

                    repository.save(analysis);

                    return new SinistroJobPayload(
                            analysis.getId(),
                            analysis.getPlate(),
                            analysis.getStartDate(),
                            analysis.getEndDate()
                    );

                });

    }

    @Transactional
    public void receiveUpload(
            UUID id,
            MultipartFile kmMensalFile,
            List<MultipartFile> speedFiles,
            String status,
            String errorMessage
    ) {

        SinistroAnalysis analysis = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Análise não encontrada: " + id));

        if ("ERROR".equalsIgnoreCase(status)) {

            analysis.setStatus(SinistroStatus.ERROR);
            analysis.setErrorMessage(errorMessage != null ? errorMessage : "Falha reportada pelo ETL");
            repository.save(analysis);

            return;

        }

        try {

            Path analysisDir = resolveAnalysisDir(id);

            List<KmDayEntry> kmData = List.of();

            if (kmMensalFile != null && !kmMensalFile.isEmpty()) {

                kmData = kmParserService.parse(kmMensalFile.getInputStream(), analysis.getPlate());

                saveOriginalFile(analysisDir, kmMensalFile);

            }

            List<SpeedEventEntry> speedData = new ArrayList<>();

            if (speedFiles != null) {

                for (MultipartFile speedFile : speedFiles) {

                    if (speedFile.isEmpty()) continue;

                    speedData.addAll(speedParserService.parse(speedFile.getInputStream()));

                    saveOriginalFile(analysisDir, speedFile);

                }

            }

            SinistroIndicators indicators = indicatorService.compute(
                    kmData, speedData,
                    analysis.getSinistroType(),
                    analysis.getSinistroDate(),
                    analysis.getSinistroTime()
            );

            String report = indicatorService.buildReport(
                    analysis.getPlate(),
                    analysis.getInsuredName(),
                    analysis.getStartDate(),
                    analysis.getEndDate(),
                    indicators
            );

            analysis.setKmData(writeJson(kmData));
            analysis.setSpeedData(writeJson(speedData));
            analysis.setIndicators(writeJson(indicators));
            analysis.setReport(report);
            analysis.setStatus(SinistroStatus.DONE);

            Files.writeString(analysisDir.resolve("relatorio.txt"), report);

        } catch (Exception e) {

            log.error("[SINISTRO] Falha ao processar upload da análise {}", id, e);

            analysis.setStatus(SinistroStatus.ERROR);
            analysis.setErrorMessage("Falha ao processar arquivos recebidos: " + e.getMessage());

        }

        repository.save(analysis);

    }

    public SinistroStatusResponse getStatus(UUID id) {

        SinistroAnalysis analysis = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Análise não encontrada: " + id));

        return new SinistroStatusResponse(
                analysis.getId(),
                analysis.getPlate(),
                analysis.getInsuredName(),
                analysis.getStartDate(),
                analysis.getEndDate(),
                analysis.getSinistroDate(),
                analysis.getSinistroTime(),
                analysis.getSinistroType(),
                analysis.getStatus(),
                readJson(analysis.getKmData(), new TypeReference<List<KmDayEntry>>() {
                }),
                readJson(analysis.getSpeedData(), new TypeReference<List<SpeedEventEntry>>() {
                }),
                readJson(analysis.getIndicators(), new TypeReference<SinistroIndicators>() {
                }),
                analysis.getReport(),
                analysis.getErrorMessage(),
                analysis.getCreatedAt()
        );

    }

    public List<SinistroHistoryResponse> getHistory() {

        return repository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(SinistroHistoryResponse::from)
                .toList();

    }

    public Path resolveAnalysisDir(UUID id) throws IOException {

        Path dir = Path.of(storageProperties.getRoot(), "sinistro", id.toString());

        Files.createDirectories(dir);

        return dir;

    }

    private void saveOriginalFile(Path analysisDir, MultipartFile file) throws IOException {

        String fileName = file.getOriginalFilename() != null
                ? file.getOriginalFilename()
                : "arquivo_" + UUID.randomUUID() + ".xls";

        Files.copy(
                file.getInputStream(),
                analysisDir.resolve(fileName),
                java.nio.file.StandardCopyOption.REPLACE_EXISTING
        );

    }

    private String writeJson(Object value) {

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Falha ao serializar dados da análise", e);
        }

    }

    private <T> T readJson(String json, TypeReference<T> typeReference) {

        if (json == null || json.isBlank()) return null;

        try {
            return objectMapper.readValue(json, typeReference);
        } catch (JsonProcessingException e) {
            log.warn("[SINISTRO] Falha ao desserializar JSON armazenado", e);
            return null;
        }

    }

}
