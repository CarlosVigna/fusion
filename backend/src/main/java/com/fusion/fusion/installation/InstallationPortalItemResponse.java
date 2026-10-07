package com.fusion.fusion.installation;

import java.time.LocalDateTime;

public record InstallationPortalItemResponse(

        Long id,

        String externalId,

        String customerName,

        String plate,

        String model,

        Long numeroProposta,

        String prazoConclusao,

        String portalTecnico,

        LocalDateTime dataAtualizacao,

        String slaCor,

        String slaLabel,

        String portalStatus,

        String parceiro

) {

    public static InstallationPortalItemResponse from(Installation i) {
        return new InstallationPortalItemResponse(
                i.getId(),
                i.getExternalId(),
                i.getCustomerName(),
                i.getPlate(),
                i.getModel(),
                i.getNumeroProposta(),
                i.getPrazoConclusao(),
                i.getPortalTecnico(),
                i.getDataAtualizacao(),
                i.getSlaCor(),
                i.getSlaLabel(),
                i.getPortalStatus(),
                i.getParceiro()
        );
    }

}
