package com.fusion.fusion.importation.storage.service;

import com.fusion.fusion.importation.storage.config.ImportStorageProperties;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;

@Service
@RequiredArgsConstructor
public class ImportPathResolver {

    private final ImportStorageProperties properties;

    public Path resolvePending() {

        return Paths.get(
                properties.getRoot(),
                "pending"
        );

    }

    public Path resolveProcessing() {

        return Paths.get(
                properties.getRoot(),
                "processing"
        );

    }

    public Path resolveFailed() {

        return Paths.get(
                properties.getRoot(),
                "failed"
        );

    }

    public Path resolveBackup(
            ImportPlatform platform
    ) {

        return Paths.get(
                properties.getRoot(),
                "backup",
                platform.name().toLowerCase()
        );

    }

}