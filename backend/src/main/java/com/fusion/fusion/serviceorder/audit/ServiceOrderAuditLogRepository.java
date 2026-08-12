package com.fusion.fusion.serviceorder.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface ServiceOrderAuditLogRepository extends JpaRepository<ServiceOrderAuditLog, UUID> {

    List<ServiceOrderAuditLog> findByServiceOrderIdOrderByPerformedAtDesc(UUID serviceOrderId);

    List<ServiceOrderAuditLog> findAllByOrderByPerformedAtDesc();

    List<ServiceOrderAuditLog> findByPlateContainingIgnoreCaseOrderByPerformedAtDesc(String plate);

    List<ServiceOrderAuditLog> findByActionOrderByPerformedAtDesc(String action);

    List<ServiceOrderAuditLog> findByPerformedAtBetweenOrderByPerformedAtDesc(LocalDateTime from, LocalDateTime to);
}
