package com.fusion.fusion.letter;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LetterRecordService {

    private final LetterRecordRepository repository;

    private final VehicleRepository vehicleRepository;

    public List<LetterRecordResponse> findAll() {

        return repository.findAllByOrderByDataEnvioDesc()
                .stream()
                .map(LetterRecordResponse::from)
                .toList();

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
