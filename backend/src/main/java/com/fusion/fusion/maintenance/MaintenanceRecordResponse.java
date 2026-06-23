package com.fusion.fusion.maintenance;

import java.time.LocalDate;

public record MaintenanceRecordResponse(

        Long id,

        String plate,

        String insuredName,

        String modelo,

        String localPosicao,

        String cidadeUf,

        LocalDate data,

        LocalDate prazoEncerramento,

        String base,

        String operador,

        MaintenanceStatus status,

        LocalDate dataEncerramento

) {

    public static MaintenanceRecordResponse from(
            MaintenanceRecord record
    ) {

        return new MaintenanceRecordResponse(

                record.getId(),

                record.getVehicle() != null
                        ? record.getVehicle().getPlate()
                        : null,

                record.getInsuredName(),

                record.getModelo(),

                record.getLocalPosicao(),

                record.getCidadeUf(),

                record.getData(),

                record.getPrazoEncerramento(),

                record.getBase(),

                record.getOperador(),

                record.getStatus(),

                record.getDataEncerramento()

        );

    }

}
