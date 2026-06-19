package com.fusion.fusion.importation;

import jakarta.validation.constraints.NotBlank;

public record PasteImportRequest(

        @NotBlank
        String content

) {
}
