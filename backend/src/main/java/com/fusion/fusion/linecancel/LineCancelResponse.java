package com.fusion.fusion.linecancel;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record LineCancelResponse(

        UUID id,

        String plate,

        String insuredName,

        String iccid,

        String msisdn,

        String imei,

        LocalDate policyEndDate,

        LocalDate cancelledAt,

        String policyStatus,

        LineCancelStatus status,

        LocalDate verifiedAt,

        String verifiedBy,

        LocalDate requestedAt,

        String requestedBy,

        LocalDateTime createdAt

) {

    public static LineCancelResponse from(LineCancel lc) {

        return new LineCancelResponse(
                lc.getId(),
                lc.getPlate(),
                lc.getInsuredName(),
                lc.getIccid(),
                lc.getMsisdn(),
                lc.getImei(),
                lc.getPolicyEndDate(),
                lc.getCancelledAt(),
                lc.getPolicyStatus(),
                lc.getStatus(),
                lc.getVerifiedAt(),
                lc.getVerifiedBy(),
                lc.getRequestedAt(),
                lc.getRequestedBy(),
                lc.getCreatedAt()
        );

    }

}
