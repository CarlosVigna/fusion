package com.fusion.fusion.operational.projection;

import com.fusion.fusion.operational.rules.OperationalRulesProperties;
import com.fusion.fusion.operational.rules.OperationalRulesService;
import com.fusion.fusion.vehicle.OperationalStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class VehicleOperationalProjectionService {

    private final VehicleOperationalStateRepository
            operationalRepository;

    private final OperationalRulesService
            rulesService;

    private final OperationalRulesProperties
            properties;

    public VehicleOperationalProjection build(
            Vehicle vehicle
    ) {

        return build(
                vehicle,
                operationalRepository
                        .findFirstByVehicle(vehicle)
                        .orElse(null)
        );

    }

    public VehicleOperationalProjection build(
            Vehicle vehicle,
            VehicleOperationalState operational
    ) {

        boolean staleUpdate = false;

        if (operational != null
                && operational.getLastCommunicationAt() != null) {

            staleUpdate =
                    operational.getLastCommunicationAt()
                            .isBefore(
                                    LocalDateTime.now(ZoneOffset.UTC)
                                            .minusHours(
                                                    properties.getStaleUpdateHours()
                                            )
                            );

        }

        boolean lowBattery =
                operational != null
                        && rulesService.isLowBattery(
                        operational.getBatteryLevel()
                );

        OperationalStatus status =
                calculateStatus(
                        vehicle,
                        operational,
                        staleUpdate,
                        lowBattery
                );

        return VehicleOperationalProjection.builder()

                .vehicle(vehicle)

                .online(
                        operational != null
                                && Boolean.TRUE.equals(
                                operational.getOnline()
                        )
                )

                .batteryLevel(
                        operational != null
                                ? operational.getBatteryLevel()
                                : null
                )

                .communicationStatus(
                        operational != null
                                ? operational.getCommunicationStatus()
                                : null
                )

                .signalDelayMinutes(
                        operational != null
                                ? operational.getSignalDelayMinutes()
                                : null
                )

                .lastCommunicationAt(
                        operational != null
                                ? operational.getLastCommunicationAt()
                                : null
                )

                .staleUpdate(staleUpdate)

                .lowBattery(lowBattery)

                .operationalStatus(status)

                .build();

    }

    private OperationalStatus calculateStatus(

            Vehicle vehicle,

            VehicleOperationalState operational,

            boolean staleUpdate,

            boolean lowBattery

    ) {

        if (Boolean.TRUE.equals(
                vehicle.getInMaintenance()
        )) {

            return OperationalStatus.MAINTENANCE;

        }

        if (lowBattery) {

            return OperationalStatus.LOW_BATTERY;

        }

        if (staleUpdate) {

            return OperationalStatus.STALE;

        }

        if (operational == null) {

            return OperationalStatus.OFFLINE;

        }

        if (Boolean.TRUE.equals(
                operational.getOnline()
        )) {

            return OperationalStatus.ONLINE;

        }

        return OperationalStatus.OFFLINE;

    }

}