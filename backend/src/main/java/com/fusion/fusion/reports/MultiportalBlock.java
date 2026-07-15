package com.fusion.fusion.reports;

import java.util.List;

public record MultiportalBlock(

        String title,

        List<MultiportalRow> rows,

        int total

) {
}
