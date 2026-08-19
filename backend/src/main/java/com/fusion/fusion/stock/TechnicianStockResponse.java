package com.fusion.fusion.stock;

import java.time.LocalDate;
import java.util.UUID;

public record TechnicianStockResponse(
        Long id,
        UUID technicianId,
        String technicianName,
        String imei,
        String iccid,
        String chipLine,
        String model,
        LocalDate receivedAt,
        LocalDate sentAt,
        LocalDate installedAt,
        String installedPlate,
        StockStatus status
) {

    public static TechnicianStockResponse from(TechnicianStock s) {
        return new TechnicianStockResponse(
                s.getId(),
                s.getTechnician() != null ? s.getTechnician().getId() : null,
                s.getTechnician() != null ? s.getTechnician().getName() : null,
                s.getImei(),
                s.getIccid(),
                s.getChipLine(),
                s.getModel(),
                s.getReceivedAt(),
                s.getSentAt(),
                s.getInstalledAt(),
                s.getInstalledPlate(),
                s.getStatus()
        );
    }

}
