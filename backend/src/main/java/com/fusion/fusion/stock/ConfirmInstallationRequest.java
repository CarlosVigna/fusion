package com.fusion.fusion.stock;

import java.time.LocalDate;

public record ConfirmInstallationRequest(
        String plate,
        LocalDate installedAt
) {}
