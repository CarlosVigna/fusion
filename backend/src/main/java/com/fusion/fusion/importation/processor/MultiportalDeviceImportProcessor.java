package com.fusion.fusion.importation.processor;

import com.fusion.fusion.importation.orchestrator.*;
import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.vehicle.multiportal.device.DeviceImportResponse;
import com.fusion.fusion.vehicle.multiportal.device.DeviceImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.stereotype.Component;

import java.nio.file.Files;

@Component
@RequiredArgsConstructor
public class MultiportalDeviceImportProcessor
        implements ImportProcessor {

    private final DeviceImportService
            service;

    @Override
    public boolean supports(
            ImportExecutionContext context
    ) {

        return context.getType()
                == ImportFileType.MULTIPORTAL_DEVICES;

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

            DeviceImportResponse response =
                    service.importFile(file);

            return ImportExecutionResult.builder()
                    .success(true)
                    .message("Importação Multiportal Device concluída")
                    .processedRecords(
                            response.importedDevices()
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