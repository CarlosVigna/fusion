package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.common.security.CurrentUserService;
import com.fusion.fusion.letter.LetterRecord;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.vehicle.Vehicle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SignalReturnAlertService {

    private static final DateTimeFormatter BAIXA_DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final SignalReturnAlertRepository repository;

    private final CurrentUserService currentUserService;

    private final VehicleObservationService observationService;

    private final LetterRecordRepository letterRecordRepository;

    public List<SignalReturnAlertResponse> findActive() {

        Map<UUID, VehicleObservation> latestObsByVehicleId =
                observationService.findLatestByVehicleId();

        return repository.findByDismissedFalseOrderByDetectedAtDesc()
                .stream()
                .map(alert -> SignalReturnAlertResponse.from(
                        alert,
                        latestObsByVehicleId.get(
                                alert.getVehicle().getId()
                        )
                ))
                .toList();

    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void create(
            Vehicle vehicle,
            Integer previousDelayMinutes
    ) {

        if (repository.findByVehicleAndDismissedFalse(vehicle)
                .isPresent()) {

            return; // já existe um alerta ativo para esse veículo

        }

        SignalReturnAlert alert = SignalReturnAlert.builder()
                .vehicle(vehicle)
                .previousDelayMinutes(previousDelayMinutes)
                .build();

        repository.save(alert);

    }

    @Transactional
    public void dismiss(Long id) {

        SignalReturnAlert alert = findOrThrow(id);

        alert.setDismissed(true);

        alert.setDismissedAt(LocalDateTime.now(ZoneOffset.UTC));

        alert.setDismissedBy(
                currentUserService.getCurrentUserName()
        );

        repository.save(alert);

    }

    // Acao da Central Operacional: alem de dispensar o alerta, atualiza
    // a carta de suspensao ativa do veiculo (se existir) marcando a data
    // de retorno de sinal — operador nao precisa abrir Cartas a parte.
    @Transactional
    public void markSignalReturned(Long id) {

        SignalReturnAlert alert = findOrThrow(id);

        Vehicle vehicle = alert.getVehicle();

        if (vehicle != null) {

            letterRecordRepository
                    .findByVehicleAndDataRetornoSinal(
                            vehicle,
                            "Sem retorno."
                    )
                    .ifPresent(letter -> {

                        letter.setDataRetornoSinal(
                                LocalDateTime.now(ZoneOffset.UTC)
                                        .format(BAIXA_DATE_FORMATTER)
                        );

                        letterRecordRepository.save(letter);

                    });

        }

        alert.setDismissed(true);

        alert.setDismissedAt(LocalDateTime.now(ZoneOffset.UTC));

        alert.setDismissedBy(
                currentUserService.getCurrentUserName()
        );

        repository.save(alert);

    }

    private SignalReturnAlert findOrThrow(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Alerta não encontrado"
                ));

    }

    // Uma unica query em vez de 1 findByVehicleAndDismissedFalse por
    // veiculo — usado pelo Controle de Sinais para sobrepor a etapa
    // sugerida com SIGNAL_RETURNED quando ha alerta ativo.
    public Map<UUID, SignalReturnAlert> findActiveByVehicleId() {

        Map<UUID, SignalReturnAlert> result = new HashMap<>();

        for (SignalReturnAlert alert :
                repository.findByDismissedFalseOrderByDetectedAtDesc()) {

            if (alert.getVehicle() != null) {

                result.put(
                        alert.getVehicle().getId(),
                        alert
                );

            }

        }

        return result;

    }

}
