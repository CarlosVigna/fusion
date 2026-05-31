package com.fusion.fusion.importation.processor;

import com.fusion.fusion.importation.orchestrator.*;
import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.vehicle.tracknme.TracknMeImportResponse;
import com.fusion.fusion.vehicle.tracknme.TracknMeImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.stereotype.Component;

import java.nio.file.Files;

@Component
@RequiredArgsConstructor
public class TracknMeImportProcessor
        implements ImportProcessor {

    private final TracknMeImportService
            service;

    @Override
    public boolean supports(
            ImportExecutionContext context
    ) {

        return context.getType()
                == ImportFileType.TRACKNME_TRACKERS;

    }

    @Override
    public ImportExecutionResult process(
            ImportExecutionContext context
    ) {

        try {

            byte[] content =
                    Files.readAllBytes(
                            context.getFile()
                    );

            MockMultipartFile file =
                    new MockMultipartFile(
                            "file",
                            context.getFileName(),
                            "application/octet-stream",
                            content
                    );

            TracknMeImportResponse response =
                    service.importFile(file);

            return ImportExecutionResult.builder()
                    .success(true)
                    .message("Importação TracknMe concluída")
                    .processedRecords(
                            response.updatedVehicles()
                                    + response.createdVehicles()
                    )
                    .build();

        } catch (Exception e) {

            return ImportExecutionResult.builder()
                    .success(false)
                    .message(e.getMessage())
                    .processedRecords(0)
                    .build();

        }

    }

}