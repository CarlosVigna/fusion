package com.fusion.fusion.policy;

import java.time.LocalDate;
import java.util.List;

public record PolicyVerifyResult(
        List<PolicyVerifyEntry> correct,
        List<PolicyVerifyEntry> divergent,
        List<PolicyVerifyEntry> notFound
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
}
