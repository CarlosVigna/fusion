package com.fusion.fusion.installation;

public record InstallationFinancialApprovalRequest(
        String financialApprovalStatus,
        Double declaredValue,
        Double calculatedKm,
        Double calculatedDisplacement
) {}
