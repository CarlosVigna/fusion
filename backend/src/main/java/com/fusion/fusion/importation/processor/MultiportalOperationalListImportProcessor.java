package com.fusion.fusion.importation.processor;

import com.fusion.fusion.importation.orchestrator.*;
import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalListImportResponse;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalListImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.stereotype.Component;

import java.nio.file.Files;

@Component
@RequiredArgsConstructor
public class MultiportalOperationalListImportProcessor
        implements ImportProcessor {

    private final OperationalListImportService
            service;

    @Override
    public boolean supports(
            ImportExecutionContext context
    ) {

        return context.getType()
                == ImportFileType.MULTIPORTAL_LIST;

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

            OperationalListImportResponse response =
                    service.importFile(file);

            return ImportExecutionResult.builder()
                    .success(true)
                    .message("Importação Última Posição concluída")
                    .processedRecords(
                            response.updatedVehicles()
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
