package com.fusion.fusion.policy;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public record PolicyResponse(
        Long id,
        String plate,
        String policyNumber,
        LocalDate startDate,
        LocalDate endDate,
        PolicyStatus status,
        String insuredName,
        String cpfCnpj,
        String vehicleModel,
        String vehicleBrand,
        Integer bonus,
        String statusDescricao,
        PolicySource source,
        LocalDateTime createdAt
) {

    static PolicyStatus computeStatus(Policy p) {
        if (p.getStatus() == PolicyStatus.CANCELLED) {
            return PolicyStatus.CANCELLED;
        }
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (p.getEndDate() != null && p.getEndDate().isBefore(today)) {
            return PolicyStatus.EXPIRED;
        }
        if (p.getStartDate() != null && p.getStartDate().isAfter(today)) {
            return PolicyStatus.FUTURE;
        }
        if (p.getEndDate() != null && !p.getEndDate().isAfter(today.plusDays(30))) {
            return PolicyStatus.EXPIRING;
        }
        return PolicyStatus.ACTIVE;
    }

    public static PolicyResponse from(Policy p) {
        return new PolicyResponse(
                p.getId(),
                p.getPlate(),
                p.getPolicyNumber(),
                p.getStartDate(),
                p.getEndDate(),
                computeStatus(p),
                p.getInsuredName(),
                p.getCpfCnpj(),
                p.getVehicleModel(),
                p.getVehicleBrand(),
                p.getBonus(),
                p.getStatusDescricao(),
                p.getSource(),
                p.getCreatedAt()
        );
    }

}
