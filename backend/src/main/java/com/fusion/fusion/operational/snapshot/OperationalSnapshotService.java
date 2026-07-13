package com.fusion.fusion.operational.snapshot;

import com.fusion.fusion.operational.projection.VehicleOperationalProjection;
import com.fusion.fusion.operational.projection.VehicleOperationalProjectionService;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

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

        refresh(
                vehicle,
                null,
                repository.findFirstByVehicle(vehicle)
                        .orElse(null)
        );

    }

    public void refresh(
            Vehicle vehicle,
            VehicleOperationalState state,
            OperationalSnapshot existingSnapshot
    ) {

        VehicleOperationalProjection projection =
                state != null
                        ? projectionService.build(vehicle, state)
                        : projectionService.build(vehicle);

        OperationalSnapshot snapshot =
                existingSnapshot != null
                        ? existingSnapshot
                        : OperationalSnapshot.builder()
                                .vehicle(vehicle)
                                .build();

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
                LocalDateTime.now(ZoneOffset.UTC)
        );

        repository.save(snapshot);

    }

}