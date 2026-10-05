package com.fusion.fusion.installation;

import java.time.LocalDateTime;
import java.util.UUID;

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

        String serviceType,

        String portalStatus,

        // So' usado na criacao manual (POST /installations) — o sync em
        // lote do portal (POST /installations/sync) nunca manda esse
        // campo, fica null e createFromInstallation() trata normalmente.
        UUID technicianId

) {
}
