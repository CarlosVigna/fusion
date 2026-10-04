package com.fusion.fusion.installation;

import java.math.BigDecimal;

public record WhatsAppApprovalSummary(
        Long installationId,
        String plate,
        String customerName,
        String technicianName,
        String technicianCpf,
        BigDecimal value,
        Double distanceKm,
        BigDecimal displacementFee,
        BigDecimal totalValue,
        String formattedMessage
) {
}
