package com.fusion.fusion.reports;

import java.util.List;

public record MultiportalBlocks(

        List<MultiportalRow> operational,

        List<MultiportalRow> kako,

        List<MultiportalRow> tests,

        List<MultiportalRow> verification

) {

    public List<MultiportalRow> getAllRows() {
        List<MultiportalRow> all = new java.util.ArrayList<>();
        if (operational  != null) all.addAll(operational);
        if (kako         != null) all.addAll(kako);
        if (tests        != null) all.addAll(tests);
        if (verification != null) all.addAll(verification);
        return all;
    }

}
