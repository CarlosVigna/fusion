package com.fusion.fusion.operational.engine;

import com.fusion.fusion.operational.detector.LowBatteryDetector;
import com.fusion.fusion.operational.detector.OperationalDetector;
import com.fusion.fusion.operational.detector.StaleUpdateDetector;
import com.fusion.fusion.operational.rules.OperationalRulesService;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotService;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperationalStateEngineService {

    private final VehicleOperationalStateRepository repository;

    private final List<OperationalDetector> detectors;

    private final OperationalSnapshotService
            snapshotService;

    private final OperationalRulesService
            rulesService;

    public void processAll() {

        List<VehicleOperationalState> states =
                repository.findAll();

        for (VehicleOperationalState state : states) {

            try {

                process(state);

            } catch (Exception e) {

                log.error(
                        "Erro ao processar estado operacional do veículo {}",
                        state.getVehicle() != null
                                ? state.getVehicle().getPlate()
                                : state.getId(),
                        e
                );

            }

        }

    }

    public void process(
            VehicleOperationalState state
    ) {

        CommunicationStatus previousStatus =
                state.getCommunicationStatus();

        CommunicationStatus newStatus =
                calculateStatus(state);

        state.setCommunicationStatus(newStatus);

        state.setOnline(
                newStatus == CommunicationStatus.ONLINE
        );

        state.setUpdatedAt(
                LocalDateTime.now()
        );

        repository.save(state);
        snapshotService.refresh(
                state.getVehicle()
        );

        if (previousStatus != newStatus) {

            executeDetectors(state);

        }

        executeAdvancedDetectors(state);


    }

    private void executeAdvancedDetectors(
            VehicleOperationalState state
    ) {

        for (OperationalDetector detector :
                detectors) {

            if (
                    detector instanceof LowBatteryDetector
                            || detector instanceof StaleUpdateDetector
            ) {

                detector.detect(state);

            }

        }

    }

    private void executeDetectors(
            VehicleOperationalState state
    ) {

        for (OperationalDetector detector :
                detectors) {

            if (
                    detector instanceof LowBatteryDetector
                            || detector instanceof StaleUpdateDetector
            ) {

                continue;

            }

            detector.detect(state);

        }

    }

    private CommunicationStatus calculateStatus(
            VehicleOperationalState state
    ) {

        if (state.getLastCommunicationAt() == null) {

            state.setSignalDelayMinutes(null);

            return CommunicationStatus.NO_COMMUNICATION;

        }

        long minutes =
                Duration.between(
                        state.getLastCommunicationAt(),
                        LocalDateTime.now()
                ).toMinutes();

        state.setSignalDelayMinutes(
                (int) minutes
        );

        return rulesService
                .resolveCommunicationStatus(
                        minutes
                );

    }

}