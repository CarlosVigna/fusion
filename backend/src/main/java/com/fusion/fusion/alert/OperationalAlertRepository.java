package com.fusion.fusion.alert;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface OperationalAlertRepository
        extends JpaRepository<OperationalAlert, Long> {

    Optional<OperationalAlert> findFirstByVehicleAndTypeAndStatus(
            Vehicle vehicle,
            OperationalAlertType type,
            OperationalAlertStatus status
    );

    // Usado pela limpeza periodica (CleanupScheduler) — so remove
    // alertas ja RESOLVED. Um alerta ainda OPEN nunca e' apagado so por
    // idade, mesmo vencido ha' meses.
    long deleteByStatusAndOpenedAtBefore(
            OperationalAlertStatus status,
            LocalDateTime before
    );

}