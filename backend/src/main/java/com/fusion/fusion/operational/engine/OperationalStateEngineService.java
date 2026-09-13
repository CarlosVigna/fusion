package com.fusion.fusion.operational.engine;

import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.detector.LowBatteryDetector;
import com.fusion.fusion.operational.detector.OperationalDetector;
import com.fusion.fusion.operational.detector.StaleUpdateDetector;
import com.fusion.fusion.operational.rules.OperationalRulesService;
import com.fusion.fusion.signalcontrol.SignalReturnAlertService;
import com.fusion.fusion.stock.StockStatus;
import com.fusion.fusion.stock.TechnicianStock;
import com.fusion.fusion.stock.TechnicianStockRepository;
import com.fusion.fusion.stock.TechnicianStockService;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
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
import java.util.stream.Collectors;

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

    private final TechnicianStockRepository
            technicianStockRepository;

    // Spring nao aplica @Transactional em chamadas diretas this.method()
    // (bypassa o proxy AOP). Self-injection via @Lazy garante que
    // processSingle() seja chamado pelo proxy e receba REQUIRES_NEW.
    @Lazy
    @Autowired
    private OperationalStateEngineService self;

    private static final int SIGNAL_RETURN_THRESHOLD_MINUTES = 2880;

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

        // Idem para os linkages ativos e o estoque de tecnicos — eram 1-2
        // reads por veiculo dentro de checkTechnicianStockPositioning()
        // (deviceLinkageRepository.findByVehicle + stockRepository.
        // findFirstByImei...), agora carregados uma vez so'.
        Map<UUID, DeviceLinkage> activeLinkageByVehicleId =
                deviceLinkageRepository.findAllActiveWithVehicleAndDevice()
                        .stream()
                        .filter(l -> l.getVehicle() != null)
                        .collect(Collectors.toMap(
                                l -> l.getVehicle().getId(),
                                l -> l,
                                (a, b) -> a
                        ));

        // IMEI nao e' unico por design (equipamento devolvido pode
        // reaparecer em estoque de outro tecnico depois — ver comentario
        // em TechnicianStockRepository) — o merge precisa ficar com o
        // EM_ESTOQUE mais recente, igual o ORDER BY created_at DESC que
        // findFirstByImeiAndStatusOrderByCreatedAtDesc fazia no banco.
        // Um merge simples tipo (a, b) -> a dependeria da ordem arbitraria
        // de findAll() e poderia pegar o registro errado.
        Map<String, TechnicianStock> stockByImei =
                technicianStockRepository.findAll()
                        .stream()
                        .filter(s -> s.getImei() != null && s.getStatus() == StockStatus.EM_ESTOQUE)
                        .collect(Collectors.toMap(
                                TechnicianStock::getImei,
                                s -> s,
                                (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b
                        ));

        for (VehicleOperationalState state : states) {

            try {

                self.processSingle(
                        state,
                        snapshotsByVehicleId.get(
                                state.getVehicle().getId()
                        ),
                        latestObservationByVehicleId.get(
                                state.getVehicle().getId()
                        ),
                        activeLinkageByVehicleId,
                        stockByImei
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
            VehicleObservation lastObservation,
            Map<UUID, DeviceLinkage> activeLinkageByVehicleId,
            Map<String, TechnicianStock> stockByImei
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

        checkTechnicianStockPositioning(state, activeLinkageByVehicleId, stockByImei);

        if (previousStatus != newStatus) {

            executeDetectors(state);

        }

        executeAdvancedDetectors(state);

        detectSignalReturn(
                state,
                previousDelayMinutes,
                lastObservation
        );

    }

    // Se o dispositivo ativo do veiculo tem IMEI cadastrado no estoque
    // de algum tecnico (status EM_ESTOQUE), sinaliza uma possivel
    // instalacao recem-feita — ver TechnicianStockService.
    // checkImeiOnPositioning() e' idempotente (nao duplica pendencia se
    // ja existe uma nao confirmada), entao chamar isso todo ciclo
    // horario do motor pra todo veiculo com posicao e' seguro.
    private void checkTechnicianStockPositioning(
            VehicleOperationalState state,
            Map<UUID, DeviceLinkage> activeLinkageByVehicleId,
            Map<String, TechnicianStock> stockByImei
    ) {

        if (state.getLastCommunicationAt() == null || state.getVehicle() == null) {
            return;
        }

        // Mapa ja' vem so' com linkages active=true (query em processAll()
        // filtra isso), entao um get() aqui equivale ao
        // findByVehicle().filter(active).findFirst() de antes — sem o
        // round-trip por veiculo. Continua pegando "o primeiro" achado em
        // caso de mais de um linkage ativo pro mesmo veiculo (anomalia,
        // mesma premissa de antes).
        DeviceLinkage activeLinkage =
                activeLinkageByVehicleId.get(state.getVehicle().getId());

        String imei =
                activeLinkage != null && activeLinkage.getDevice() != null
                        ? activeLinkage.getDevice().getImei()
                        : null;

        if (imei == null || imei.isBlank()) {
            return;
        }

        technicianStockService.checkImeiOnPositioning(
                imei, state.getVehicle().getPlate(), stockByImei
        );

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
