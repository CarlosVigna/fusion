package com.fusion.fusion.importation.storage.service;

import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
@RequiredArgsConstructor
public class ImportBackupService {

    private final ImportPathResolver pathResolver;

    private final ImportRetentionService retentionService;

    public Path moveToBackup(
            Path source,
            ImportPlatform platform,
            String fileName
    ) {

        try {

            Path backupFolder =
                    pathResolver.resolveBackup(platform);

            Files.createDirectories(backupFolder);

            Path target =
                    backupFolder.resolve(fileName);

            Files.move(
                    source,
                    target,
                    StandardCopyOption.REPLACE_EXISTING
            );

            retentionService.apply(backupFolder);

            return target;

        } catch (IOException e) {
            throw new RuntimeException(e);
        }

    }

}