package com.fusion.fusion.reports;

import java.time.LocalDateTime;

public record MultiportalSheetResponse(

        MultiportalBlocks blocks,

        LocalDateTime generatedAt

) {
}
