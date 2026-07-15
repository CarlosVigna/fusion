package com.fusion.fusion.reports;

import java.util.List;

public record MultiportalBlocks(

        List<MultiportalRow> operational,

        List<MultiportalRow> kako,

        List<MultiportalRow> tests,

        List<MultiportalRow> verification

) {
}
