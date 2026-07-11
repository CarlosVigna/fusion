package com.fusion.fusion.policy;

import java.time.LocalDate;

public record PolicyRequest(
        String plate,
        String policyNumber,
        LocalDate startDate,
        LocalDate endDate,
        PolicyStatus status,
        String insuredName,
        String cpfCnpj,
        String vehicleModel,
        PolicySource source
) {
}
