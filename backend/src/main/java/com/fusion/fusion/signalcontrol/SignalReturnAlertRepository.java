package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SignalReturnAlertRepository
        extends JpaRepository<SignalReturnAlert, Long> {

    List<SignalReturnAlert> findByDismissedFalseOrderByDetectedAtDesc();

    Optional<SignalReturnAlert> findFirstByVehicleAndDismissedFalse(
            Vehicle vehicle
    );

    // Usado pela limpeza periodica (CleanupScheduler) — entidade nao tem
    // createdAt, so' detectedAt. So remove alertas ja dismissados; um
    // ativo nunca e' apagado so por idade.
    long deleteByDismissedTrueAndDetectedAtBefore(LocalDateTime before);

}
