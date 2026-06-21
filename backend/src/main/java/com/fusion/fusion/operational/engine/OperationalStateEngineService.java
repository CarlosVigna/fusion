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
import org.springframework.transaction.annotation.Transactional;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotService;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperationalStateEngineService {

    private final VehicleOperationalStateRepository repository;

    private final List<OperationalDetector> detectors;

    private final OperationalSnapshotService
            snapshotService;

    private final OperationalSnapshotRepository
            snapshotRepository;

    private final OperationalRulesService
            rulesService;

    // Sem isso, cada repository.save() (state, snapshot, alert, timeline,
    // occurrence) abre/comita sua propria transacao — ~8 round trips de
    // commit por veiculo so para o caminho de abrir um alerta novo. Cada
    // commit para o Neon tem latencia de rede propria (confirmado via
    // EXPLAIN ANALYZE: a query em si executa em <1ms — o tempo estava todo
    // no overhead de commit, nao na query). Uma unica transacao para a
    // passada inteira reduz isso a 1 commit no final.
    @Transactional
    public void processAll() {

        List<VehicleOperationalState> states =
                repository.findAll();

        // Pre-carrega os snapshots de uma vez em vez de 1 findByVehicle
        // por veiculo dentro do refresh() — era o N+1 que fazia uma
        // unica passada do motor sobre ~260 veiculos levar mais de 1h.
        Map<UUID, OperationalSnapshot> snapshotsByVehicleId =
                new HashMap<>();

        for (OperationalSnapshot snapshot :
                snapshotRepository.findAll()) {

            if (snapshot.getVehicle() != null) {
                snapshotsByVehicleId.put(
                        snapshot.getVehicle().getId(),
                        snapshot
                );
            }

        }

        for (VehicleOperationalState state : states) {

            try {

                process(
                        state,
                        snapshotsByVehicleId.get(
                                state.getVehicle().getId()
                        )
                );

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

        process(state, null);

    }

    public void process(
            VehicleOperationalState state,
            OperationalSnapshot existingSnapshot
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
                state.getVehicle(),
                state,
                existingSnapshot
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