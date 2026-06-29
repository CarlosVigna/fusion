package com.fusion.fusion.vehicle;

import com.fusion.fusion.letter.LetterRecordResponse;
import com.fusion.fusion.maintenance.MaintenanceRecordResponse;
import com.fusion.fusion.observation.VehicleObservationResponse;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

// Ficha completa do veiculo — junta Vehicle, OperationalSnapshot
// (status/posicao), DeviceLinkage ativo (dispositivo/linha), carta e
// manutencao ativas + historico, e a ultima observacao. Uma unica
// chamada pra montar a tela de detalhe sem o frontend ter que orquestrar
// 5 requisicoes e lidar com campos ausentes virando null/undefined.
public record VehicleDetailResponse(

        UUID id,

        String plate,

        String insuredName,

        VehiclePlatform platform,

        String partnership,

        String policy,

        String broker,

        Boolean inMaintenance,

        String maintenanceOperator,

        // Operacional (de OperationalSnapshot — pode ser null se o
        // veiculo nunca comunicou ainda)
        OperationalStatus status,

        CommunicationStatus communicationStatus,

        Boolean online,

        Integer batteryLevel,

        Boolean staleUpdate,

        Boolean lowBattery,

        LocalDateTime lastCommunicationAt,

        Integer signalDelayMinutes,

        // Dispositivo ativo (de DeviceLinkage — pode ser null sem
        // vinculo ativo)
        String activeDevice,

        String imei,

        String manufacturer,

        String model,

        String lineNumber,

        String operator,

        // Carta de suspensao ativa (null se nao houver)
        LetterRecordResponse activeLetter,

        List<LetterRecordResponse> letterHistory,

        // Manutencao aberta (null se nao houver)
        MaintenanceRecordResponse activeMaintenance,

        List<MaintenanceRecordResponse> maintenanceHistory,

        VehicleObservationResponse lastObservation

) {
}
