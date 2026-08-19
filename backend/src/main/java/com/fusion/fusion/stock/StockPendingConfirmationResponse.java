package com.fusion.fusion.stock;

import java.time.LocalDateTime;
import java.util.UUID;

public record StockPendingConfirmationResponse(
        Long id,
        Long stockId,
        UUID technicianId,
        String technicianName,
        String imei,
        String model,
        String chipLine,
        String plate,
        LocalDateTime detectedAt
) {

    public static StockPendingConfirmationResponse from(StockPendingConfirmation p) {
        TechnicianStock stock = p.getStock();
        return new StockPendingConfirmationResponse(
                p.getId(),
                stock != null ? stock.getId() : null,
                stock != null && stock.getTechnician() != null ? stock.getTechnician().getId() : null,
                stock != null && stock.getTechnician() != null ? stock.getTechnician().getName() : null,
                stock != null ? stock.getImei() : null,
                stock != null ? stock.getModel() : null,
                stock != null ? stock.getChipLine() : null,
                p.getPlate(),
                p.getDetectedAt()
        );
    }

}
