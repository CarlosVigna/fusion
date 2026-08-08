package com.fusion.fusion.serviceorder;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface ServiceOrderAuditLogRepository extends JpaRepository<ServiceOrderAuditLog, UUID> {

    @Query("SELECT l FROM ServiceOrderAuditLog l WHERE " +
           "(:plate IS NULL OR l.plate = :plate) AND " +
           "(:action IS NULL OR l.action = :action) AND " +
           "(:performedBy IS NULL OR l.performedBy = :performedBy) AND " +
           "(:dateFrom IS NULL OR l.performedAt >= :dateFrom) AND " +
           "(:dateTo IS NULL OR l.performedAt <= :dateTo) " +
           "ORDER BY l.performedAt DESC")
    List<ServiceOrderAuditLog> findFiltered(
            @Param("plate") String plate,
            @Param("action") String action,
            @Param("performedBy") String performedBy,
            @Param("dateFrom") LocalDateTime dateFrom,
            @Param("dateTo") LocalDateTime dateTo
    );
}
