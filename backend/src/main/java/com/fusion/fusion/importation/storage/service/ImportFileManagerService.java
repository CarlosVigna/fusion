package com.fusion.fusion.importation.storage.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
@RequiredArgsConstructor
public class ImportFileManagerService {

    private final ImportPathResolver pathResolver;

    public Path moveToProcessing(Path source) {

        try {

            Files.createDirectories(
                    pathResolver.resolveProcessing()
            );

            Path target =
                    pathResolver.resolveProcessing()
                            .resolve(source.getFileName());

            return Files.move(
                    source,
                    target,
                    StandardCopyOption.REPLACE_EXISTING
            );

        } catch (IOException e) {
            throw new RuntimeException(e);
        }

    }

    public Path moveToFailed(Path source) {

        try {

            Files.createDirectories(
                    pathResolver.resolveFailed()
            );

            Path target =
                    pathResolver.resolveFailed()
                            .resolve(source.getFileName());

            return Files.move(
                    source,
                    target,
                    StandardCopyOption.REPLACE_EXISTING
            );

        } catch (IOException e) {
            throw new RuntimeException(e);
        }

    }

}