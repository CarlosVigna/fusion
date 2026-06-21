package com.fusion.fusion.dashboard;

import com.fusion.fusion.alert.OperationalAlertRepository;
import com.fusion.fusion.alert.OperationalAlertStatus;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.vehicle.OperationalStatus;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final OperationalSnapshotRepository
            snapshotRepository;

    private final OperationalAlertRepository
            alertRepository;

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

        return DashboardProjection.builder()

                .totalVehicles(totalVehicles)

                .onlineVehicles(onlineVehicles)

                .delayedVehicles(delayedVehicles)

                .noCommunicationVehicles(noCommunicationVehicles)

                .maintenanceVehicles(maintenanceVehicles)

                .lowBatteryVehicles(lowBatteryVehicles)

                .staleVehicles(staleVehicles)

                .openAlerts(openAlerts)

                .build();

    }

}