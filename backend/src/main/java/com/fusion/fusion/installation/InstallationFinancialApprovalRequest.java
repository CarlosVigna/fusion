package com.fusion.fusion.installation;

import java.util.UUID;

public class InstallationFinancialApprovalRequest {

    private String financialApprovalStatus; // "APROVADO" ou "REPROVADO"
    private Double declaredValue;
    private UUID technicianId;
    private Double calculatedKm;
    private Double calculatedDisplacement;

    public String getFinancialApprovalStatus() { return financialApprovalStatus; }
    public void setFinancialApprovalStatus(String financialApprovalStatus) { this.financialApprovalStatus = financialApprovalStatus; }

    public Double getDeclaredValue() { return declaredValue; }
    public void setDeclaredValue(Double declaredValue) { this.declaredValue = declaredValue; }

    public UUID getTechnicianId() { return technicianId; }
    public void setTechnicianId(UUID technicianId) { this.technicianId = technicianId; }

    public Double getCalculatedKm() { return calculatedKm; }
    public void setCalculatedKm(Double calculatedKm) { this.calculatedKm = calculatedKm; }

    public Double getCalculatedDisplacement() { return calculatedDisplacement; }
    public void setCalculatedDisplacement(Double calculatedDisplacement) { this.calculatedDisplacement = calculatedDisplacement; }

}
