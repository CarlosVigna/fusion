package com.fusion.fusion.importation.preview;

import java.util.List;

public record ImportPreviewItem(

        String plate,

        ImportDiffType type,

        List<ImportFieldDiff> differences

) {
}