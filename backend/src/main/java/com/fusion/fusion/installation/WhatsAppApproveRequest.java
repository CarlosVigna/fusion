package com.fusion.fusion.installation;

import java.math.BigDecimal;

public record WhatsAppApproveRequest(
        String plate,
        String technicianCpf,
        BigDecimal value
) {
}
