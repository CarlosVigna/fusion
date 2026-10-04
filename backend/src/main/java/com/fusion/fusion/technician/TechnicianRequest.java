package com.fusion.fusion.technician;

import java.math.BigDecimal;

public record TechnicianRequest(
        String name,
        String cpf,
        String phone,
        String address,
        String city,
        String state,
        String zipCode,
        String neighborhood,
        BigDecimal defaultServiceValue
) {}
