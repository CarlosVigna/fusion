package com.fusion.fusion.policy;

import java.time.LocalDate;
import java.util.List;

public record PolicyVerifyResult(
        List<PolicyVerifyEntry> correct,
        List<PolicyVerifyEntry> divergent,
        List<StatusChangedEntry> statusChanged,
        List<NewPolicyEntry> newPolicies
) {
    public record PolicyVerifyEntry(
            Long id,
            String plate,
            String policyNumber,
            LocalDate endDate,
            String statusDescricao,
            String portalPolicyNumber,
            LocalDate portalEndDate,
            String portalStatusDescricao
    ) {}

    public record StatusChangedEntry(
            Long id,
            String plate,
            String insuredName,
            String currentStatus,
            String newStatus,
            EtlPolicyResult.EtlPolicyData portalData
    ) {}

    public record NewPolicyEntry(
            String plate,
            String insuredName,
            EtlPolicyResult.EtlPolicyData portalData
    ) {}
}
