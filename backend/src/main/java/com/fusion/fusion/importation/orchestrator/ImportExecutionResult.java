package com.fusion.fusion.importation.orchestrator;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ImportExecutionResult {

    private boolean success;

    private String message;

    private Integer processedRecords;

}