package com.fusion.fusion.sinistro;

import java.util.UUID;

public record SinistroStartResponse(

        UUID id,

        SinistroStatus status

) {
}
