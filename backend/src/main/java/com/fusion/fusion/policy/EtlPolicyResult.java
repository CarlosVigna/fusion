package com.fusion.fusion.policy;

public record EtlPolicyResult(
        boolean found,
        EtlPolicyData data
) {
    public record EtlPolicyData(
            String policyNumber,
            String startDate,
            String endDate,
            String insuredName,
            String cpfCnpj,
            String plate,
            String vehicleModel,
            String vehicleBrand,
            Integer bonus,
            String statusDescricao
    ) {}
}
