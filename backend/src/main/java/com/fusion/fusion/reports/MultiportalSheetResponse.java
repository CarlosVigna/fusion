package com.fusion.fusion.reports;

public record MultiportalSheetResponse(

        MultiportalBlock operational,

        MultiportalBlock kako,

        MultiportalBlock tests,

        MultiportalBlock verification

) {
}
