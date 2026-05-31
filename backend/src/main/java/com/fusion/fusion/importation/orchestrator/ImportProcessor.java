package com.fusion.fusion.importation.orchestrator;

public interface ImportProcessor {

    boolean supports(
            ImportExecutionContext context
    );

    ImportExecutionResult process(
            ImportExecutionContext context
    );

}