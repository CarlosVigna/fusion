package com.fusion.fusion.serviceorder;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ServiceOrderRepository extends JpaRepository<ServiceOrder, UUID> {

    List<ServiceOrder> findBySchedulingStatusOrderByRequestedAtDesc(SchedulingStatus status);

    List<ServiceOrder> findBySchedulingStatusNotOrderByRequestedAtDesc(SchedulingStatus status);

    @Query("SELECT so FROM ServiceOrder so WHERE so.scheduledDate BETWEEN :start AND :end ORDER BY so.scheduledDate")
    List<ServiceOrder> findByScheduledDateBetween(LocalDate start, LocalDate end);

    @Query("SELECT so FROM ServiceOrder so WHERE so.schedulingStatus = 'CONCLUIDO' AND FUNCTION('to_char', so.closedAt, 'YYYY-MM') = :month")
    List<ServiceOrder> findConcludedByMonth(String month);

    List<ServiceOrder> findByServiceTypeAndSchedulingStatusNotAndCompletionConfirmedFalse(
            ServiceType serviceType, SchedulingStatus status);

    boolean existsByExternalInstallationId(String externalInstallationId);
}
