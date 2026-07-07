package com.fusion.fusion.installation;

import java.time.LocalDateTime;

public record InstallationRequest(

        String externalId,

        String customerName,

        String address,

        String neighborhood,

        String city,

        String state,

        String zipCode,

        String phone,

        String plate,

        String model,

        Long numeroProposta,

        LocalDateTime portalCreatedAt,

        String serviceType

) {
}
