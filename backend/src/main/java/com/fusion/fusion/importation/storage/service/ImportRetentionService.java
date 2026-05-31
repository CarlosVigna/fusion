package com.fusion.fusion.importation.storage.service;

import com.fusion.fusion.importation.storage.config.ImportStorageProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class ImportRetentionService {

    private final ImportStorageProperties properties;

    public void apply(Path folder) {

        try (Stream<Path> stream = Files.list(folder)) {

            List<Path> files = stream
                    .filter(Files::isRegularFile)
                    .sorted(
                            Comparator.comparing(this::lastModified)
                                    .reversed()
                    )
                    .toList();

            if (files.size() <= properties.getRetention()) {
                return;
            }

            List<Path> toDelete = files.subList(
                    properties.getRetention(),
                    files.size()
            );

            for (Path file : toDelete) {
                Files.deleteIfExists(file);
            }

        } catch (IOException e) {
            throw new RuntimeException(e);
        }

    }

    private FileTime lastModified(Path path) {

        try {
            return Files.getLastModifiedTime(path);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

    }

}