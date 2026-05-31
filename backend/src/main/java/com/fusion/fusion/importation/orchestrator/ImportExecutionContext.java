package com.fusion.fusion.importation.orchestrator;

import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import lombok.Builder;
import lombok.Getter;

import java.nio.file.Path;

@Getter
@Builder
public class ImportExecutionContext {

    private Path file;

    private String fileName;

    private ImportPlatform platform;

    private ImportFileType type;

}