package com.fusion.fusion.installation;

import java.time.LocalDateTime;

public record InstallationResponse(

        Long id,

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

        InstallationStatus status,

        LocalDateTime sentAt,

        String sentBy,

        LocalDateTime createdAt

) {

    public static InstallationResponse from(Installation i) {

        return new InstallationResponse(
                i.getId(),
                i.getExternalId(),
                i.getCustomerName(),
                i.getAddress(),
                i.getNeighborhood(),
                i.getCity(),
                i.getState(),
                i.getZipCode(),
                i.getPhone(),
                i.getPlate(),
                i.getModel(),
                i.getNumeroProposta(),
                i.getPortalCreatedAt(),
                i.getServiceType(),
                i.getStatus(),
                i.getSentAt(),
                i.getSentBy(),
                i.getCreatedAt()
        );

    }

}
