package com.fusion.fusion.installation;

import java.time.LocalDateTime;

public record InstallationObservationResponse(

        Long id,

        Long installationId,

        String text,

        String createdBy,

        LocalDateTime createdAt

) {

    public static InstallationObservationResponse from(InstallationObservation obs) {
        return new InstallationObservationResponse(
                obs.getId(),
                obs.getInstallation().getId(),
                obs.getText(),
                obs.getCreatedBy(),
                obs.getCreatedAt()
        );
    }

}
