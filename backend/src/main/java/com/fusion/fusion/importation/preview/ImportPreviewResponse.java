package com.fusion.fusion.importation.preview;

import java.util.List;

public record ImportPreviewResponse(

        Integer total,

        Integer creates,

        Integer updates,

        Integer noChanges,

        List<ImportPreviewItem> items

) {
}