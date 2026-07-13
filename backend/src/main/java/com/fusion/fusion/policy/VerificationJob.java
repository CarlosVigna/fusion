package com.fusion.fusion.policy;

public record VerificationJob(
        String status,
        int processed,
        int total,
        PolicyVerifyResult result
) {}
