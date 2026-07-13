package com.fusion.fusion.policy;

import java.time.LocalDate;

public record PolicyReportRow(
        String plate,
        String insuredName,
        String policyNumber,
        LocalDate endDate,
        Integer daysRemaining,
        String statusLabel
) {}
