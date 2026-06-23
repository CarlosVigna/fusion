package com.fusion.fusion.letter;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LetterRecordRepository
        extends JpaRepository<LetterRecord, Long> {

    List<LetterRecord> findAllByOrderByDataEnvioDesc();

    Optional<LetterRecord> findByVehicleAndDataRetornoSinal(
            Vehicle vehicle,
            String dataRetornoSinal
    );

}
