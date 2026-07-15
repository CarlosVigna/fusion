package com.fusion.fusion.letter;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LetterRecordRepository
        extends JpaRepository<LetterRecord, Long> {

    List<LetterRecord> findAllByOrderByDataEnvioDesc();

    List<LetterRecord> findByStatusOrderByDataEnvioDesc(LetterStatus status);

    Optional<LetterRecord> findByVehicleAndDataRetornoSinal(
            Vehicle vehicle,
            String dataRetornoSinal
    );

    Optional<LetterRecord> findByVehicleAndStatus(
            Vehicle vehicle,
            LetterStatus status
    );

    long countByDataRetornoSinal(String dataRetornoSinal);

    long countByStatus(LetterStatus status);

    List<LetterRecord> findByVehicleOrderByDataEnvioDesc(Vehicle vehicle);

    boolean existsByVehicleAndDataEnvio(Vehicle vehicle, LocalDate dataEnvio);

}
