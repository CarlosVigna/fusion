package com.fusion.fusion.policy;

import java.time.LocalDate;

public record PolicyAlertResponse(
        Long id,
        String plate,
        String insuredName,
        String policyNumber,
        LocalDate endDate,
        String alertType,
        Integer daysRemaining
) {}
