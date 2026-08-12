package com.fusion.fusion.vehicle.tracknme;

import com.fusion.fusion.importation.ImportDiffLog;
import com.fusion.fusion.importation.ImportDiffLogRepository;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.importation.preview.ImportPreviewResponse;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fusion.fusion.importation.confirm.ImportConfirmRequest;
import com.fusion.fusion.importation.confirm.ImportConfirmResponse;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/tracknme")
@RequiredArgsConstructor
public class TracknMeController {

    private final TracknMeImportService service;
    private final TracknMePreviewService previewService;
    private final TracknMeConfirmService confirmService;
    private final VehicleRepository vehicleRepository;
    private final ImportDiffLogRepository diffLogRepository;

    @PostMapping("/import")
    public TracknMeImportResponse importFile(
            @RequestParam("file") MultipartFile file
    ) {

        return service.importFile(file);

    }

    @PostMapping("/preview")
    public ImportPreviewResponse preview(
            @RequestParam("file") MultipartFile file
    ) {

        return previewService.preview(file);

    }

    @PostMapping("/confirm")
    public ImportConfirmResponse confirm(
            @RequestBody ImportConfirmRequest request
    ) {

        return confirmService.confirm(request);

    }

    @GetMapping("/history")
    public List<ImportDiffLog> history(
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo
    ) {
        List<ImportType> types = List.of(ImportType.TRACKNME, ImportType.TRACKNME_POSITION);
        List<ImportDiffLog> logs = diffLogRepository.findByImportTypeInOrderByCreatedAtDesc(types);

        if (dateFrom != null && !dateFrom.isBlank()) {
            LocalDate from = LocalDate.parse(dateFrom);
            logs = logs.stream()
                    .filter(l -> !l.getCreatedAt().toLocalDate().isBefore(from))
                    .toList();
        }
        if (dateTo != null && !dateTo.isBlank()) {
            LocalDate to = LocalDate.parse(dateTo);
            logs = logs.stream()
                    .filter(l -> !l.getCreatedAt().toLocalDate().isAfter(to))
                    .toList();
        }

        return logs;
    }

    @GetMapping("/pending")
    public List<TracknMePendingResponse> pending() {
        return vehicleRepository.findAll().stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.TRACKNME
                        && v.getDeletedAt() == null
                        && (v.getInsuredName() == null || v.getInsuredName().isBlank()))
                .map(v -> new TracknMePendingResponse(
                        v.getPlate(),
                        v.getTracknmeDeviceId(),
                        v.getCreatedAt()
                ))
                .sorted(java.util.Comparator.comparing(
                        TracknMePendingResponse::plate
                ))
                .toList();
    }

}