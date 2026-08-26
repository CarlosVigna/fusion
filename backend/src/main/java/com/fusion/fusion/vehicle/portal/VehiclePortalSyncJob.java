package com.fusion.fusion.vehicle.portal;

// Mesmo padrao do VerificationJob de PolicyService (@Async + Map em
// memoria) — status: "RUNNING" | "DONE" | "ERROR" | "NOT_FOUND".
public record VehiclePortalSyncJob(
        String status,
        int processed,
        int total,
        VehiclePortalSyncSummary result
) {}
