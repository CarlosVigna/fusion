package com.fusion.fusion.importation.orchestrator;

import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import org.springframework.stereotype.Service;

@Service
public class ImportFileDetectorService {

    public ImportExecutionContext detect(
            java.nio.file.Path file
    ) {

        String fileName =
                file.getFileName()
                        .toString()
                        .toUpperCase();

        if (fileName.contains("TRACK")) {

            return ImportExecutionContext.builder()
                    .file(file)
                    .fileName(fileName)
                    .platform(ImportPlatform.TRACKNME)
                    .type(
                            ImportFileType.TRACKNME_TRACKERS
                    )
                    .build();

        }

        if (fileName.contains("DEVICE")
                || (fileName.contains("DISPOSITIVO")
                        && !fileName.contains("VINCULO"))) {

            return ImportExecutionContext.builder()
                    .file(file)
                    .fileName(fileName)
                    .platform(ImportPlatform.MULTIPORTAL)
                    .type(
                            ImportFileType.MULTIPORTAL_DEVICES
                    )
                    .build();

        }

        if (fileName.contains("LINK")
                || fileName.contains("VINCULO")) {

            return ImportExecutionContext.builder()
                    .file(file)
                    .fileName(fileName)
                    .platform(ImportPlatform.MULTIPORTAL)
                    .type(
                            ImportFileType.MULTIPORTAL_LINKS
                    )
                    .build();

        }

        if (fileName.contains("OPER")
                || fileName.contains("ULTIMA_POSICAO")) {

            return ImportExecutionContext.builder()
                    .file(file)
                    .fileName(fileName)
                    .platform(ImportPlatform.MULTIPORTAL)
                    .type(
                            ImportFileType.MULTIPORTAL_LIST
                    )
                    .build();

        }

        throw new RuntimeException(
                "Tipo de importação não identificado: "
                        + fileName
        );

    }

}