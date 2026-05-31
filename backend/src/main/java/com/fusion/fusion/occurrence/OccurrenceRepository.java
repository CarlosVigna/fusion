package com.fusion.fusion.occurrence;

import com.fusion.fusion.alert.OperationalAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OccurrenceRepository
        extends JpaRepository<Occurrence, UUID> {

    Optional<Occurrence> findByAlert(
            OperationalAlert alert
    );

}