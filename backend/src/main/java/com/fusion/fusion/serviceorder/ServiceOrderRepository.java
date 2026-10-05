package com.fusion.fusion.serviceorder;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ServiceOrderRepository extends JpaRepository<ServiceOrder, UUID> {

    List<ServiceOrder> findBySchedulingStatusOrderByRequestedAtDesc(SchedulingStatus status);

    // Usado pelo bot do WhatsApp (approvalFlow.js) pra achar a OS aberta
    // de uma placa — "aberta" aqui significa qualquer status != CONCLUIDO
    // (ABERTO/AGUARDANDO_APROVACAO/AGENDADO), igual ja' e' tratado em
    // isLate()/dashboard(). Se houver mais de uma, pega a mais recente
    // (requestedAt desc).
    Optional<ServiceOrder> findFirstByPlateIgnoreCaseAndSchedulingStatusNotAndDeletedAtIsNullOrderByRequestedAtDesc(
            String plate, SchedulingStatus status);

    List<ServiceOrder> findBySchedulingStatusNotOrderByRequestedAtDesc(SchedulingStatus status);

    @Query("SELECT so FROM ServiceOrder so WHERE so.scheduledDate BETWEEN :start AND :end ORDER BY so.scheduledDate")
    List<ServiceOrder> findByScheduledDateBetween(LocalDate start, LocalDate end);

    @Query("SELECT so FROM ServiceOrder so WHERE so.schedulingStatus = 'CONCLUIDO' AND so.deletedAt IS NULL AND FUNCTION('to_char', so.closedAt, 'YYYY-MM') = :month")
    List<ServiceOrder> findConcludedByMonth(String month);

    List<ServiceOrder> findByServiceTypeAndSchedulingStatusNotAndCompletionConfirmedFalseAndDeletedAtIsNull(
            ServiceType serviceType, SchedulingStatus status);

    boolean existsByExternalInstallationId(String externalInstallationId);
}
