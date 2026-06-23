package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SignalControlService {

    // > 24h sem sinal.
    private static final int DELAY_THRESHOLD_MINUTES = 1440;

    private final VehicleRepository vehicleRepository;

    private final VehicleOperationalStateRepository stateRepository;

    private final OperationalSnapshotRepository snapshotRepository;

    private final VehicleObservationService observationService;

    private final SignalReturnAlertService signalReturnAlertService;

    private final SignalStageService signalStageService;

    public List<SignalControlResponse> findAll() {

        Map<UUID, VehicleOperationalState> statesByVehicleId =
                new HashMap<>();

        for (VehicleOperationalState state : stateRepository.findAll()) {

            if (state.getVehicle() != null) {
                statesByVehicleId.put(
                        state.getVehicle().getId(),
                        state
                );
            }

        }

        Map<UUID, OperationalSnapshot> snapshotsByVehicleId =
                new HashMap<>();

        for (OperationalSnapshot snapshot : snapshotRepository.findAll()) {

            if (snapshot.getVehicle() != null) {
                snapshotsByVehicleId.put(
                        snapshot.getVehicle().getId(),
                        snapshot
                );
            }

        }

        Map<UUID, VehicleObservation> latestObservationByVehicleId =
                observationService.findLatestByVehicleId();

        Map<UUID, SignalReturnAlert> activeAlertByVehicleId =
                signalReturnAlertService.findActiveByVehicleId();

        List<SignalControlResponse> result = new ArrayList<>();

        for (Vehicle vehicle : vehicleRepository.findAll()) {

            if (vehicle.getDeletedAt() != null
                    || !Boolean.TRUE.equals(
                    vehicle.getHasEverCommunicated()
            )) {

                continue;

            }

            VehicleOperationalState state =
                    statesByVehicleId.get(vehicle.getId());

            if (state == null
                    || state.getSignalDelayMinutes() == null
                    || state.getSignalDelayMinutes()
                    <= DELAY_THRESHOLD_MINUTES) {

                continue;

            }

            VehicleObservation lastObservation =
                    latestObservationByVehicleId.get(vehicle.getId());

            SignalStage stage = activeAlertByVehicleId.containsKey(
                    vehicle.getId()
            )
                    ? SignalStage.SIGNAL_RETURNED
                    : signalStageService.calculateStage(
                    vehicle,
                    state,
                    lastObservation
            );

            result.add(
                    build(
                            vehicle,
                            state,
                            snapshotsByVehicleId.get(vehicle.getId()),
                            stage,
                            lastObservation
                    )
            );

        }

        result.sort(
                Comparator.comparing(
                        SignalControlResponse::signalDelayMinutes,
                        Comparator.nullsLast(Comparator.reverseOrder())
                )
        );

        return result;

    }

    private SignalControlResponse build(
            Vehicle vehicle,
            VehicleOperationalState state,
            OperationalSnapshot snapshot,
            SignalStage stage,
            VehicleObservation lastObservation
    ) {

        SignalControlResponse.ObservationSummary observationSummary =
                lastObservation != null
                        ? new SignalControlResponse.ObservationSummary(
                        lastObservation.getId(),
                        lastObservation.getText(),
                        lastObservation.getCreatedAt(),
                        lastObservation.getCreatedBy()
                )
                        : null;

        SignalControlResponse.CheckSummary checkSummary =
                lastObservation != null
                        && Boolean.TRUE.equals(
                        lastObservation.getCheckedOff()
                )
                        ? new SignalControlResponse.CheckSummary(
                        lastObservation.getCheckedAt(),
                        lastObservation.getCheckedBy()
                )
                        : null;

        return new SignalControlResponse(

                vehicle.getPlate(),

                vehicle.getInsuredName(),

                vehicle.getPlatform(),

                state.getLastCommunicationAt(),

                state.getSignalDelayMinutes(),

                snapshot != null
                        ? snapshot.getOperationalStatus()
                        : null,

                stage,

                observationSummary,

                checkSummary

        );

    }

}
