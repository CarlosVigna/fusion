package com.fusion.fusion.maintenance;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MaintenanceRecordService {

    private final MaintenanceRecordRepository repository;

    private final VehicleRepository vehicleRepository;

    public List<MaintenanceRecordResponse> findAll(
            boolean includeClosed
    ) {

        List<MaintenanceRecord> records = includeClosed
                ? repository.findAllByOrderByDataDesc()
                : repository.findByStatusOrderByDataDesc(
                MaintenanceStatus.ABERTO
        );

        return records.stream()
                .map(MaintenanceRecordResponse::from)
                .toList();

    }

    // Central Operacional — manutencoes abertas cujo prazo ja venceu.
    public List<MaintenanceRecordResponse> findOverdue() {

        return repository
                .findByStatusAndPrazoEncerramentoLessThanEqualOrderByPrazoEncerramentoAsc(
                        MaintenanceStatus.ABERTO,
                        LocalDate.now(ZoneOffset.UTC)
                )
                .stream()
                .map(MaintenanceRecordResponse::from)
                .toList();

    }

    @Transactional
    public MaintenanceRecordResponse create(
            MaintenanceRecordRequest request
    ) {

        MaintenanceRecord record = MaintenanceRecord.builder()
                .vehicle(findVehicle(request.plate()))
                .insuredName(request.insuredName())
                .modelo(request.modelo())
                .localPosicao(request.localPosicao())
                .cidadeUf(request.cidadeUf())
                .data(request.data())
                .prazoEncerramento(request.prazoEncerramento())
                .base(request.base())
                .operador(request.operador())
                .build();

        repository.save(record);

        return MaintenanceRecordResponse.from(record);

    }

    @Transactional
    public MaintenanceRecordResponse update(
            Long id,
            MaintenanceRecordRequest request
    ) {

        MaintenanceRecord record = findRecord(id);

        record.setVehicle(findVehicle(request.plate()));

        record.setInsuredName(request.insuredName());

        record.setModelo(request.modelo());

        record.setLocalPosicao(request.localPosicao());

        record.setCidadeUf(request.cidadeUf());

        record.setData(request.data());

        record.setPrazoEncerramento(request.prazoEncerramento());

        record.setBase(request.base());

        record.setOperador(request.operador());

        repository.save(record);

        return MaintenanceRecordResponse.from(record);

    }

    @Transactional
    public MaintenanceRecordResponse close(Long id) {

        MaintenanceRecord record = findRecord(id);

        record.setStatus(MaintenanceStatus.ENCERRADO);

        record.setDataEncerramento(LocalDate.now());

        repository.save(record);

        return MaintenanceRecordResponse.from(record);

    }

    @Transactional
    public MaintenanceRecordResponse baixar(Long id) {

        MaintenanceRecord record = findRecord(id);

        record.setStatus(MaintenanceStatus.BAIXADA);

        record.setDataEncerramento(LocalDate.now(ZoneOffset.UTC));

        repository.save(record);

        return MaintenanceRecordResponse.from(record);

    }

    @Transactional
    public MaintenanceRecordResponse prorrogar(Long id, LocalDate novoPrazo) {

        MaintenanceRecord record = findRecord(id);

        record.setPrazoEncerramento(novoPrazo);

        repository.save(record);

        return MaintenanceRecordResponse.from(record);

    }

    @Transactional
    public void delete(Long id) {

        repository.deleteById(id);

    }

    private MaintenanceRecord findRecord(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Registro de manutenção não encontrado"
                ));

    }

    private Vehicle findVehicle(String plate) {

        return vehicleRepository.findByPlate(plate)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Veículo não encontrado: " + plate
                ));

    }

}
