package com.fusion.fusion.pendingchange;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PendingChangeRepository
        extends JpaRepository<PendingChange, Long> {

    List<PendingChange> findByStatusOrderByDetectedAtDesc(
            String status
    );

    Optional<PendingChange> findByVehiclePlateAndFieldNameAndStatus(
            String vehiclePlate,
            String fieldName,
            String status
    );

    long countByStatus(String status);

}
