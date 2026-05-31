package com.fusion.fusion.operational.snapshot;

import com.fusion.fusion.operational.projection.VehicleOperationalProjection;
import com.fusion.fusion.operational.projection.VehicleOperationalProjectionService;
import com.fusion.fusion.vehicle.Vehicle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class OperationalSnapshotService {

    private final OperationalSnapshotRepository
            repository;

    private final VehicleOperationalProjectionService
            projectionService;

    public void refresh(
            Vehicle vehicle
    ) {

        VehicleOperationalProjection projection =
                projectionService.build(vehicle);

        OperationalSnapshot snapshot =
                repository.findByVehicle(vehicle)
                        .orElse(
                                OperationalSnapshot.builder()
                                        .vehicle(vehicle)
                                        .build()
                        );

        snapshot.setOnline(
                projection.getOnline()
        );

        snapshot.setBatteryLevel(
                projection.getBatteryLevel()
        );

        snapshot.setCommunicationStatus(
                projection.getCommunicationStatus()
        );

        snapshot.setSignalDelayMinutes(
                projection.getSignalDelayMinutes()
        );

        snapshot.setStaleUpdate(
                projection.getStaleUpdate()
        );

        snapshot.setLowBattery(
                projection.getLowBattery()
        );

        snapshot.setOperationalStatus(
                projection.getOperationalStatus()
        );

        snapshot.setLastCommunicationAt(
                projection.getLastCommunicationAt()
        );

        snapshot.setUpdatedAt(
                LocalDateTime.now()
        );

        repository.save(snapshot);

    }

}