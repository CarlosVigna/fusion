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

        long totalVehicles =
                snapshotRepository.count();

        long onlineVehicles =
                snapshotRepository.findAll()
                        .stream()
                        .filter(snapshot ->
                                snapshot.getCommunicationStatus()
                                        == CommunicationStatus.ONLINE
                        )
                        .count();

        long delayedVehicles =
                snapshotRepository.findAll()
                        .stream()
                        .filter(snapshot ->
                                snapshot.getCommunicationStatus()
                                        == CommunicationStatus.DELAYED
                        )
                        .count();

        long noCommunicationVehicles =
                snapshotRepository.findAll()
                        .stream()
                        .filter(snapshot ->
                                snapshot.getCommunicationStatus()
                                        == CommunicationStatus.NO_COMMUNICATION
                        )
                        .count();

        long maintenanceVehicles =
                snapshotRepository.findAll()
                        .stream()
                        .filter(snapshot ->
                                snapshot.getOperationalStatus()
                                        == OperationalStatus.MAINTENANCE
                        )
                        .count();

        long lowBatteryVehicles =
                snapshotRepository.findAll()
                        .stream()
                        .filter(snapshot ->
                                Boolean.TRUE.equals(
                                        snapshot.getLowBattery()
                                )
                        )
                        .count();

        long staleVehicles =
                snapshotRepository.findAll()
                        .stream()
                        .filter(snapshot ->
                                Boolean.TRUE.equals(
                                        snapshot.getStaleUpdate()
                                )
                        )
                        .count();

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