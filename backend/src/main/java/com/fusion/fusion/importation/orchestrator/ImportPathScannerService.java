package com.fusion.fusion.importation.orchestrator;

import com.fusion.fusion.importation.storage.service.ImportPathResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class ImportPathScannerService {

    private final ImportPathResolver
            pathResolver;

    public List<Path> scan() {

        Path pendingFolder =
                pathResolver.resolvePending();

        try {

            Files.createDirectories(
                    pendingFolder
            );

            try (Stream<Path> stream =
                         Files.list(pendingFolder)) {

                return stream
                        .filter(Files::isRegularFile)
                        .toList();

            }

        } catch (IOException e) {

            throw new RuntimeException(e);

        }

    }

}