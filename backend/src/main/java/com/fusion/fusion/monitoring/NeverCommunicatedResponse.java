package com.fusion.fusion.monitoring;

import java.time.LocalDateTime;

public record NeverCommunicatedResponse(

        String plate,

        String insuredName,

        LocalDateTime linkedSince,

        String diagnosis,

        String suggestedAction

) {
}
