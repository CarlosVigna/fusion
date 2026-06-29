package com.fusion.fusion.dashboard;

import com.fusion.fusion.alert.OperationalAlertRepository;
import com.fusion.fusion.alert.OperationalAlertStatus;
import com.fusion.fusion.importation.ImportHistoryRepository;
import com.fusion.fusion.importation.ImportStatus;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.maintenance.MaintenanceRecordRepository;
import com.fusion.fusion.maintenance.MaintenanceStatus;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.pendingchange.PendingChangeRepository;
import com.fusion.fusion.pendingchange.PendingChangeStatus;
import com.fusion.fusion.vehicle.OperationalStatus;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class DashboardService {

    // Mesmo limiar usado pelo Controle de Sinais (24h) pra definir
    // "sinal atrasado".
    private static final int SIGNAL_DELAY_THRESHOLD_MINUTES = 1440;

    private final OperationalSnapshotRepository
            snapshotRepository;

    private final OperationalAlertRepository
            alertRepository;

    private final VehicleRepository
            vehicleRepository;

    private final LetterRecordRepository
            letterRecordRepository;

    private final PendingChangeRepository
            pendingChangeRepository;

    private final MaintenanceRecordRepository
            maintenanceRecordRepository;

    private final ImportHistoryRepository
            importHistoryRepository;

    private final VehicleOperationalStateRepository
            operationalStateRepository;

    public DashboardProjection build() {

        // Uma unica passada sobre os snapshots em vez de 1 findAll() por
        // metrica — eram 6 table scans completos da operational_snapshot
        // a cada chamada, disparada toda vez que um alerta novo abre
        // (ex.: motor operacional detectando um veiculo stale por
        // primeira vez), travando a thread do motor.
        var snapshots = snapshotRepository.findAll();

        long totalVehicles = snapshots.size();
        long onlineVehicles = 0;
        long delayedVehicles = 0;
        long noCommunicationVehicles = 0;
        long maintenanceVehicles = 0;
        long lowBatteryVehicles = 0;
        long staleVehicles = 0;

        for (var snapshot : snapshots) {

            if (snapshot.getCommunicationStatus()
                    == CommunicationStatus.ONLINE) {
                onlineVehicles++;
            }

            if (snapshot.getCommunicationStatus()
                    == CommunicationStatus.DELAYED) {
                delayedVehicles++;
            }

            if (snapshot.getCommunicationStatus()
                    == CommunicationStatus.NO_COMMUNICATION) {
                noCommunicationVehicles++;
            }

            if (snapshot.getOperationalStatus()
                    == OperationalStatus.MAINTENANCE) {
                maintenanceVehicles++;
            }

            if (Boolean.TRUE.equals(snapshot.getLowBattery())) {
                lowBatteryVehicles++;
            }

            if (Boolean.TRUE.equals(snapshot.getStaleUpdate())) {
                staleVehicles++;
            }

        }

        long openAlerts =
                alertRepository.findAll()
                        .stream()
                        .filter(alert ->
                                alert.getStatus()
                                        == OperationalAlertStatus.OPEN
                        )
                        .count();

        LocalDateTime todayStart =
                LocalDateTime.now(ZoneOffset.UTC)
                        .toLocalDate()
                        .atStartOfDay();

        LocalDateTime lastEtlUpdate =
                importHistoryRepository
                        .findTopByTypeAndStatusOrderByCreatedAtDesc(
                                ImportType.MULTIPORTAL_OPERATIONAL,
                                ImportStatus.SUCCESS
                        )
                        .map(history -> history.getCreatedAt())
                        .orElse(null);

        return DashboardProjection.builder()

                .totalVehicles(totalVehicles)

                .onlineVehicles(onlineVehicles)

                .delayedVehicles(delayedVehicles)

                .noCommunicationVehicles(noCommunicationVehicles)

                .maintenanceVehicles(maintenanceVehicles)

                .lowBatteryVehicles(lowBatteryVehicles)

                .staleVehicles(staleVehicles)

                .openAlerts(openAlerts)

                .registeredVehicles(
                        vehicleRepository.countByDeletedAtIsNull()
                )

                .monitoredVehicles(totalVehicles)

                .activeLettersCount(
                        letterRecordRepository.countByDataRetornoSinal(
                                "Sem retorno."
                        )
                )

                .pendingChangesCount(
                        pendingChangeRepository.countByStatus(
                                PendingChangeStatus.PENDING
                        )
                )

                .delayedSignalCount(
                        operationalStateRepository
                                .countBySignalDelayMinutesGreaterThan(
                                        SIGNAL_DELAY_THRESHOLD_MINUTES
                                )
                )

                .overdueMaintenanceCount(
                        maintenanceRecordRepository
                                .countByStatusAndPrazoEncerramentoLessThanEqual(
                                        MaintenanceStatus.ABERTO,
                                        LocalDate.now(ZoneOffset.UTC)
                                )
                )

                .importsTodayCount(
                        importHistoryRepository
                                .countByCreatedAtAfterAndStatus(
                                        todayStart,
                                        ImportStatus.SUCCESS
                                )
                )

                .lastEtlUpdate(lastEtlUpdate)

                .build();

    }

}