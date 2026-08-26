package com.fusion.fusion.reports;

import java.util.List;

public record CustomReportRequest(
        List<String> fields,
        CustomReportFilters filters,
        String format
) {

    public record CustomReportFilters(
            List<String> groups,
            List<String> policyStatus,
            String communicationStatus,
            String city,
            String state,
            String equipment
    ) {}

}
