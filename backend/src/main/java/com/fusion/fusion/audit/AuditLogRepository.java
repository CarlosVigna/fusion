package com.fusion.fusion.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fusion.fusion.vehicle.Vehicle;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<com.fusion.fusion.audit.AuditLog, UUID> {

    List<AuditLog> findByVehicleOrderByCreatedAtDesc(
            Vehicle vehicle
    );

    // Usado pela limpeza periodica (CleanupScheduler) — trilha de
    // auditoria pura, sem estado "pendente" a preservar.
    long deleteByCreatedAtBefore(LocalDateTime before);
}

