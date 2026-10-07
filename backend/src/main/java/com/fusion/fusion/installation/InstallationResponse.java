package com.fusion.fusion.installation;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

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

        String portalStatus,

        InstallationStatus status,

        LocalDateTime sentAt,

        String sentBy,

        LocalDateTime createdAt,

        Integer slaDays,

        String slaStatus,

        String lastObservation,

        LocalDate alertDismissedAt,

        LocalDateTime closedAt

) {

    public static InstallationResponse from(Installation i) {

        Integer slaDays = null;
        String slaStatus = null;

        if (i.getPortalCreatedAt() != null && i.getStatus() == InstallationStatus.PENDING) {
            ZoneId tz = ZoneId.of("America/Sao_Paulo");
            LocalDate created = i.getPortalCreatedAt().atZone(tz).toLocalDate();
            LocalDate today = LocalDate.now(tz);
            int days = (int) ChronoUnit.DAYS.between(created, today);
            slaDays = days;
            slaStatus = days <= 1 ? "SLA_OK" : days == 2 ? "SLA_WARNING" : "SLA_CRITICAL";
        }

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
                i.getPortalStatus(),
                i.getStatus(),
                i.getSentAt(),
                i.getSentBy(),
                i.getCreatedAt(),
                slaDays,
                slaStatus,
                i.getLastObservation(),
                i.getAlertDismissedAt(),
                i.getClosedAt()
        );

    }

}
