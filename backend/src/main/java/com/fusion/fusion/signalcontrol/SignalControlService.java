package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.letter.LetterRecord;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.maintenance.MaintenanceRecord;
import com.fusion.fusion.maintenance.MaintenanceRecordRepository;
import com.fusion.fusion.maintenance.MaintenanceStatus;
import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.policy.Policy;
import com.fusion.fusion.policy.PolicyRepository;
import com.fusion.fusion.policy.PolicyResponse;
import com.fusion.fusion.policy.PolicyStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
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

    private final DeviceLinkageRepository linkageRepository;

    private final VehicleOperationalStateRepository stateRepository;

    private final OperationalSnapshotRepository snapshotRepository;

    private final VehicleObservationService observationService;

    private final SignalReturnAlertService signalReturnAlertService;

    private final SignalStageService signalStageService;

    private final LetterRecordRepository letterRecordRepository;

    private final MaintenanceRecordRepository maintenanceRecordRepository;

    private final PolicyRepository policyRepository;

    public List<SignalControlResponse> findAll(boolean includeKako) {

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

        Map<UUID, DeviceLinkage> activeLinkageByVehicleId =
                new HashMap<>();

        for (DeviceLinkage linkage :
                linkageRepository.findAllActiveWithVehicleAndDevice()) {

            if (linkage.getVehicle() != null) {

                activeLinkageByVehicleId.putIfAbsent(
                        linkage.getVehicle().getId(),
                        linkage
                );

            }

        }

        Map<UUID, VehicleObservation> latestObservationByVehicleId =
                observationService.findLatestByVehicleId();

        Map<UUID, SignalReturnAlert> activeAlertByVehicleId =
                signalReturnAlertService.findActiveByVehicleId();

        // "Carta ativa" = ainda sem retorno de sinal registrado. Uma vez
        // que o sinal volta, o operador atualiza esse campo e a carta
        // deixa de aparecer como ativa aqui.
        Map<UUID, LetterRecord> activeLetterByVehicleId =
                new HashMap<>();

        for (LetterRecord letter :
                letterRecordRepository.findAllByOrderByDataEnvioDesc()) {

            if (letter.getVehicle() != null
                    && "Sem retorno.".equals(
                    letter.getDataRetornoSinal()
            )) {

                activeLetterByVehicleId.putIfAbsent(
                        letter.getVehicle().getId(),
                        letter
                );

            }

        }

        Map<UUID, MaintenanceRecord> openMaintenanceByVehicleId =
                new HashMap<>();

        for (MaintenanceRecord maintenance :
                maintenanceRecordRepository.findByStatusOrderByDataDesc(
                        MaintenanceStatus.ABERTO
                )) {

            if (maintenance.getVehicle() != null) {

                openMaintenanceByVehicleId.putIfAbsent(
                        maintenance.getVehicle().getId(),
                        maintenance
                );

            }

        }

        Map<String, Policy> activePolicyByPlate = buildActivePolicyByPlate();

        List<SignalControlResponse> result = new ArrayList<>();

        for (Vehicle vehicle : vehicleRepository.findAll()) {

            if (vehicle.getDeletedAt() != null) {

                continue;

            }

            if (!includeKako
                    && vehicle.getVehicleGroup() == VehicleGroup.KAKO) {

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

            LetterRecord activeLetter =
                    activeLetterByVehicleId.get(vehicle.getId());

            MaintenanceRecord openMaintenance =
                    openMaintenanceByVehicleId.get(vehicle.getId());

            SignalReturnAlert activeAlert =
                    activeAlertByVehicleId.get(vehicle.getId());

            Policy activePolicy = activePolicyByPlate.get(
                    vehicle.getPlate().toUpperCase()
            );

            result.add(
                    build(
                            vehicle,
                            state,
                            snapshotsByVehicleId.get(vehicle.getId()),
                            activeLinkageByVehicleId.get(vehicle.getId()),
                            stage,
                            lastObservation,
                            activeLetter != null ? activeLetter.getId() : null,
                            openMaintenance != null ? openMaintenance.getId() : null,
                            activeAlert != null ? activeAlert.getId() : null,
                            activePolicy
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

    private Map<String, Policy> buildActivePolicyByPlate() {

        Map<String, Policy> result = new HashMap<>();

        for (Policy policy : policyRepository.findAll()) {

            if (policy.getPlate() == null) continue;

            String plate = policy.getPlate().toUpperCase();
            PolicyStatus s = PolicyResponse.computeStatus(policy);
            Policy existing = result.get(plate);

            if (existing == null) {
                result.put(plate, policy);
            } else {
                PolicyStatus es = PolicyResponse.computeStatus(existing);
                boolean newGood = s == PolicyStatus.ACTIVE || s == PolicyStatus.EXPIRING || s == PolicyStatus.FUTURE;
                boolean existGood = es == PolicyStatus.ACTIVE || es == PolicyStatus.EXPIRING || es == PolicyStatus.FUTURE;
                if (newGood && !existGood) {
                    result.put(plate, policy);
                } else if (newGood && policy.getEndDate() != null
                        && (existing.getEndDate() == null || policy.getEndDate().isAfter(existing.getEndDate()))) {
                    result.put(plate, policy);
                }
            }

        }

        return result;

    }

    private SignalControlResponse build(
            Vehicle vehicle,
            VehicleOperationalState state,
            OperationalSnapshot snapshot,
            DeviceLinkage activeLinkage,
            SignalStage stage,
            VehicleObservation lastObservation,
            Long activeLetterId,
            Long openMaintenanceId,
            Long signalReturnAlertId,
            Policy activePolicy
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

                activeLinkage != null
                        && activeLinkage.getDevice() != null
                        ? activeLinkage.getDevice().getLineNumber()
                        : null,

                state.getLastCommunicationAt(),

                state.getSignalDelayMinutes(),

                snapshot != null
                        ? snapshot.getOperationalStatus()
                        : null,

                stage,

                observationSummary,

                checkSummary,

                activeLetterId,

                openMaintenanceId,

                signalReturnAlertId,

                activePolicy != null ? activePolicy.getEndDate() : null,

                activePolicy != null ? activePolicy.getStatusDescricao() : null

        );

    }

}
