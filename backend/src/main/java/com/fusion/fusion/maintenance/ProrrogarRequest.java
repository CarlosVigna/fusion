package com.fusion.fusion.maintenance;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record ProrrogarRequest(
        @NotNull LocalDate novoPrazo
) {}
