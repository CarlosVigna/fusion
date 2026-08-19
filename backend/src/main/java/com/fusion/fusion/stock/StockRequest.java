package com.fusion.fusion.stock;

import java.time.LocalDate;

public record StockRequest(
        String imei,
        String iccid,
        String chipLine,
        String model,
        LocalDate receivedAt,
        LocalDate sentAt
) {}
