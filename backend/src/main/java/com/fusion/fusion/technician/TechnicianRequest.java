package com.fusion.fusion.technician;

import java.math.BigDecimal;

public record TechnicianRequest(
        String name,
        String phone,
        String address,
        String city,
        String state,
        String zipCode,
        BigDecimal defaultServiceValue
) {}
