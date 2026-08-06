package com.fusion.fusion.serviceorder;

import com.fusion.fusion.technician.TechnicianResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record ServiceOrderResponse(
        UUID id,
        String externalInstallationId,
        String requestedBy,
        LocalDateTime requestedAt,
        String plate,
        String chassis,
        String equipment,
        ServiceType serviceType,
        TechnicianResponse technician,
        SchedulingStatus schedulingStatus,
        LocalDate scheduledDate,
        String scheduledTime,
        String city,
        String address,
        String neighborhood,
        String state,
        String zipCode,
        String customerName,
        String customerPhone,
        Double distanceKm,
        BigDecimal displacementValue,
        BigDecimal serviceValue,
        BigDecimal totalValue,
        FinancialApprovalStatus financialApprovalStatus,
        Boolean completionConfirmed,
        Boolean completionAlertSent,
        String observations,
        String createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime closedAt,
        LocalDateTime scheduledAt,
        Boolean completedWithoutSignal,
        long slaDays,
        boolean isLate
) {}
