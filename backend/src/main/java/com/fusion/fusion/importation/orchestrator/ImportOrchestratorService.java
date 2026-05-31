package com.fusion.fusion.importation.orchestrator;

import com.fusion.fusion.importation.storage.service.ImportBackupService;
import com.fusion.fusion.importation.storage.service.ImportFileManagerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportOrchestratorService {

    private final ImportPathScannerService
            scannerService;

    private final ImportFileManagerService
            fileManagerService;

    private final ImportFileDetectorService
            detectorService;

    private final ImportBackupService
            backupService;

    private final List<ImportProcessor>
            processors;

    public void execute() {

        List<Path> pendingFiles =
                scannerService.scan();

        if (pendingFiles.isEmpty()) {

            log.info(
                    "Nenhum arquivo pendente encontrado."
            );

            return;

        }

        for (Path file : pendingFiles) {

            process(file);

        }

    }

    private void process(
            Path pendingFile
    ) {

        Path processingFile = null;

        try {

            log.info(
                    "Processando arquivo {}",
                    pendingFile.getFileName()
            );

            processingFile =
                    fileManagerService
                            .moveToProcessing(
                                    pendingFile
                            );

            ImportExecutionContext context =
                    detectorService.detect(
                            processingFile
                    );

            ImportProcessor processor =
                    processors.stream()
                            .filter(p ->
                                    p.supports(context)
                            )
                            .findFirst()
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "Nenhum processor encontrado."
                                    )
                            );

            ImportExecutionResult result =
                    processor.process(context);

            if (!result.isSuccess()) {

                throw new RuntimeException(
                        result.getMessage()
                );

            }

            backupService.moveToBackup(
                    processingFile,
                    context.getPlatform(),
                    context.getFileName()
            );

            log.info(
                    "Arquivo processado com sucesso {}",
                    context.getFileName()
            );

        } catch (Exception e) {

            log.error(
                    "Erro ao processar arquivo {}",
                    pendingFile.getFileName(),
                    e
            );

            if (processingFile != null
                    && Files.exists(processingFile)) {

                fileManagerService.moveToFailed(
                        processingFile
                );

            }

        }

    }

}