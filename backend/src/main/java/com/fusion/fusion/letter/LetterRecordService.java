package com.fusion.fusion.letter;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.signalcontrol.SignalReturnAlertRepository;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
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
public class LetterRecordService {

    private static final int PENDING_BAIXA_THRESHOLD_MINUTES = 1440;

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final LetterRecordRepository repository;

    private final VehicleRepository vehicleRepository;

    private final VehicleOperationalStateRepository stateRepository;

    private final SignalReturnAlertRepository signalReturnAlertRepository;

    public List<LetterRecordResponse> findAll(boolean includeArchived) {

        List<LetterRecord> records = includeArchived
                ? repository.findAllByOrderByDataEnvioDesc()
                : repository.findByStatusOrderByDataEnvioDesc(LetterStatus.ATIVA);

        return records.stream()
                .map(LetterRecordResponse::from)
                .toList();

    }

    // Central Operacional — cartas ativas cujo veiculo tem sinal recuperado
    // (delay < 24h). O operador precisa dar baixa na carta manualmente.
    public List<LetterRecordResponse> findPendingBaixa() {

        List<LetterRecord> active =
                repository.findByStatusOrderByDataEnvioDesc(LetterStatus.ATIVA);

        Map<UUID, Integer> delayByVehicle = new HashMap<>();

        stateRepository.findAllWithVehicle().forEach(s -> {
            if (s.getVehicle() != null) {
                delayByVehicle.put(
                        s.getVehicle().getId(),
                        s.getSignalDelayMinutes()
                );
            }
        });

        return active.stream()
                .filter(l -> {
                    if (l.getVehicle() == null) return false;
                    Integer delay = delayByVehicle.get(l.getVehicle().getId());
                    return delay != null && delay < PENDING_BAIXA_THRESHOLD_MINUTES;
                })
                .map(LetterRecordResponse::from)
                .toList();

    }

    @Transactional
    public LetterRecordResponse baixar(Long id) {

        LetterRecord record = findRecord(id);

        record.setStatus(LetterStatus.BAIXADA);

        record.setDataRetornoSinal(
                LocalDateTime.now(ZoneOffset.UTC).format(DATE_FORMATTER)
        );

        repository.save(record);

        // Descarta alerta de retorno de sinal pendente para esse veiculo
        // para que o motor nao acumule alertas sem baixa.
        signalReturnAlertRepository
                .findFirstByVehicleAndDismissedFalse(record.getVehicle())
                .ifPresent(alert -> {
                    alert.setDismissed(true);
                    alert.setDismissedAt(LocalDateTime.now(ZoneOffset.UTC));
                    alert.setDismissedBy("SISTEMA");
                    signalReturnAlertRepository.save(alert);
                });

        return LetterRecordResponse.from(record);

    }

    @Transactional
    public LetterRecordResponse reativar(Long id) {

        LetterRecord record = findRecord(id);

        record.setStatus(LetterStatus.ATIVA);

        record.setDataRetornoSinal("Sem retorno.");

        repository.save(record);

        return LetterRecordResponse.from(record);

    }

    @Transactional
    public LetterRecordResponse create(
            LetterRecordRequest request
    ) {

        LetterRecord record = LetterRecord.builder()
                .vehicle(findVehicle(request.plate()))
                .insuredName(request.insuredName())
                .base(request.base())
                .modelo(request.modelo())
                .ultimaPosicao(request.ultimaPosicao())
                .dataEnvio(request.dataEnvio())
                .fimVigencia(request.fimVigencia())
                .osAberta(request.osAberta())
                .dataRetornoSinal(request.dataRetornoSinal())
                .operador(request.operador())
                .build();

        repository.save(record);

        return LetterRecordResponse.from(record);

    }

    @Transactional
    public LetterRecordResponse update(
            Long id,
            LetterRecordRequest request
    ) {

        LetterRecord record = findRecord(id);

        record.setVehicle(findVehicle(request.plate()));

        record.setInsuredName(request.insuredName());

        record.setBase(request.base());

        record.setModelo(request.modelo());

        record.setUltimaPosicao(request.ultimaPosicao());

        record.setDataEnvio(request.dataEnvio());

        record.setFimVigencia(request.fimVigencia());

        record.setOsAberta(request.osAberta());

        record.setDataRetornoSinal(
                request.dataRetornoSinal() != null
                        && !request.dataRetornoSinal().isBlank()
                        ? request.dataRetornoSinal()
                        : "Sem retorno."
        );

        record.setOperador(request.operador());

        repository.save(record);

        return LetterRecordResponse.from(record);

    }

    @Transactional
    public void delete(Long id) {

        repository.deleteById(id);

    }

    private LetterRecord findRecord(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Carta não encontrada"
                ));

    }

    private Vehicle findVehicle(String plate) {

        return vehicleRepository.findByPlate(plate)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Veículo não encontrado: " + plate
                ));

    }

}
