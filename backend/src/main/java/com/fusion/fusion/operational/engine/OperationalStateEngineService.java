package com.fusion.fusion.operational.engine;

import com.fusion.fusion.letter.LetterRecord;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.letter.LetterStatus;
import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.detector.LowBatteryDetector;
import com.fusion.fusion.operational.detector.OperationalDetector;
import com.fusion.fusion.operational.detector.StaleUpdateDetector;
import com.fusion.fusion.operational.rules.OperationalRulesService;
import com.fusion.fusion.signalcontrol.SignalReturnAlertService;
import com.fusion.fusion.stock.TechnicianStockService;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import com.fusion.fusion.whatsapp.WhatsAppService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotService;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
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

    private final VehicleObservationService
            observationService;

    private final SignalReturnAlertService
            signalReturnAlertService;

    private final DeviceLinkageRepository
            deviceLinkageRepository;

    private final TechnicianStockService
            technicianStockService;

    private final LetterRecordRepository
            letterRecordRepository;

    private final WhatsAppService
            whatsAppService;

    // Spring nao aplica @Transactional em chamadas diretas this.method()
    // (bypassa o proxy AOP). Self-injection via @Lazy garante que
    // processSingle() seja chamado pelo proxy e receba REQUIRES_NEW.
    @Lazy
    @Autowired
    private OperationalStateEngineService self;

    private static final int SIGNAL_RETURN_THRESHOLD_MINUTES = 2880;

    // Limiar do alerta de WhatsApp — mais estrito que SIGNAL_RETURN_
    // THRESHOLD_MINUTES acima (que so cria o alerta da tela, a partir de
    // 48h). Aqui e' 3 dias sem sinal (>= 4320min) voltando a comunicar
    // ha menos de 24h (< 1440min) — evita notificar o time por oscilacao
    // curta, so por ausencias longas de verdade.
    private static final int WHATSAPP_SIGNAL_RETURN_PREVIOUS_THRESHOLD_MINUTES = 4320;
    private static final int WHATSAPP_SIGNAL_RETURN_CURRENT_THRESHOLD_MINUTES = 1440;

    // Carrega todos os dados necessarios na sessao readOnly e delega
    // cada veiculo a processSingle() via proxy (REQUIRES_NEW = conn propria).
    @Transactional(readOnly = true)
    public void processAll() {

        List<VehicleOperationalState> states =
                repository.findAllWithVehicle();

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

        // Idem para as observacoes — usado so para checar se a ultima
        // observacao ja e "#RESOLVIDO" antes de abrir alerta de retorno.
        Map<UUID, VehicleObservation> latestObservationByVehicleId =
                observationService.findLatestByVehicleId();

        for (VehicleOperationalState state : states) {

            try {

                self.processSingle(
                        state,
                        snapshotsByVehicleId.get(
                                state.getVehicle().getId()
                        ),
                        latestObservationByVehicleId.get(
                                state.getVehicle().getId()
                        )
                );

            } catch (Exception e) {

                log.error(
                        "Erro ao processar estado operacional do veículo {} — {} : {}",
                        state.getVehicle() != null
                                ? state.getVehicle().getPlate()
                                : state.getId(),
                        e.getClass().getSimpleName(),
                        e.getMessage(),
                        e
                );

            }

        }

    }

    // Transacao isolada por veiculo: se falhar (inclusive por alert/timeline
    // em T3-REQUIRES_NEW), so este veiculo e revertido. A conn readOnly de
    // processAll() nunca e contaminada por erros SQL de veiculos individuais.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processSingle(
            VehicleOperationalState state,
            OperationalSnapshot existingSnapshot,
            VehicleObservation lastObservation
    ) {

        Integer previousDelayMinutes =
                existingSnapshot != null
                        ? existingSnapshot.getSignalDelayMinutes()
                        : null;

        CommunicationStatus previousStatus =
                state.getCommunicationStatus();

        CommunicationStatus newStatus =
                calculateStatus(state);

        state.setCommunicationStatus(newStatus);

        state.setOnline(
                newStatus == CommunicationStatus.ONLINE
        );

        state.setUpdatedAt(
                LocalDateTime.now(ZoneOffset.UTC)
        );

        repository.save(state);
        snapshotService.refresh(
                state.getVehicle(),
                state,
                existingSnapshot
        );

        checkTechnicianStockPositioning(state);

        if (previousStatus != newStatus) {

            executeDetectors(state);

        }

        executeAdvancedDetectors(state);

        detectSignalReturn(
                state,
                previousDelayMinutes,
                lastObservation
        );

        notifySignalReturnedWhatsApp(
                state,
                previousDelayMinutes
        );

    }

    // Se o dispositivo ativo do veiculo tem IMEI cadastrado no estoque
    // de algum tecnico (status EM_ESTOQUE), sinaliza uma possivel
    // instalacao recem-feita — ver TechnicianStockService.
    // checkImeiOnPositioning() e' idempotente (nao duplica pendencia se
    // ja existe uma nao confirmada), entao chamar isso todo ciclo
    // horario do motor pra todo veiculo com posicao e' seguro.
    private void checkTechnicianStockPositioning(VehicleOperationalState state) {

        if (state.getLastCommunicationAt() == null || state.getVehicle() == null) {
            return;
        }

        deviceLinkageRepository.findByVehicleAndActiveTrue(state.getVehicle())
                .map(DeviceLinkage::getDevice)
                .map(device -> device != null ? device.getImei() : null)
                .filter(imei -> imei != null && !imei.isBlank())
                .ifPresent(imei -> technicianStockService.checkImeiOnPositioning(
                        imei, state.getVehicle().getPlate()
                ));

    }

    // Sinal "ausente" (> 48h) e que agora voltou (< 48h) — alerta para o
    // operador verificar se precisa retirar carta de suspensao e avisar
    // o segurado. Nao dispara se a ultima observacao ja e "#RESOLVIDO"
    // (operador ja encerrou o caso manualmente).
    private void detectSignalReturn(
            VehicleOperationalState state,
            Integer previousDelayMinutes,
            VehicleObservation lastObservation
    ) {

        boolean wasDelayed =
                previousDelayMinutes != null
                        && previousDelayMinutes > SIGNAL_RETURN_THRESHOLD_MINUTES;

        boolean nowOk =
                state.getSignalDelayMinutes() != null
                        && state.getSignalDelayMinutes() < SIGNAL_RETURN_THRESHOLD_MINUTES;

        if (!wasDelayed || !nowOk) {
            return;
        }

        boolean alreadyResolved =
                lastObservation != null
                        && lastObservation.getText() != null
                        && lastObservation.getText()
                        .toUpperCase()
                        .contains("#RESOLVIDO");

        if (alreadyResolved) {
            return;
        }

        signalReturnAlertService.create(
                state.getVehicle(),
                previousDelayMinutes
        );

    }

    // Notifica via WhatsApp quando o veiculo ficou 3+ dias sem sinal e
    // acabou de voltar a comunicar ha menos de 24h. LetterStatus nao tem
    // valor EMITIDA — ATIVA e' o status real usado pra "carta emitida e
    // ainda em aberto" no resto do sistema (ver LetterRecord/LetterStatus),
    // entao e' o que usamos aqui pra decidir hasLetter.
    private void notifySignalReturnedWhatsApp(
            VehicleOperationalState state,
            Integer previousDelayMinutes
    ) {

        boolean wasLongOffline =
                previousDelayMinutes != null
                        && previousDelayMinutes >= WHATSAPP_SIGNAL_RETURN_PREVIOUS_THRESHOLD_MINUTES;

        boolean nowOnline =
                state.getSignalDelayMinutes() != null
                        && state.getSignalDelayMinutes() < WHATSAPP_SIGNAL_RETURN_CURRENT_THRESHOLD_MINUTES;

        if (!wasLongOffline || !nowOnline || state.getVehicle() == null) {
            return;
        }

        Vehicle vehicle = state.getVehicle();

        LetterRecord letter = letterRecordRepository
                .findTopByVehicleAndStatusOrderByCreatedAtDesc(vehicle, LetterStatus.ATIVA)
                .orElse(null);

        int daysOffline = previousDelayMinutes / (24 * 60);

        whatsAppService.sendSignalReturnedAlert(
                vehicle,
                daysOffline,
                letter != null,
                state.getLastCommunicationAt(),
                letter != null ? letter.getDataEnvio() : null
        );

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
                        LocalDateTime.now(ZoneOffset.UTC)
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
