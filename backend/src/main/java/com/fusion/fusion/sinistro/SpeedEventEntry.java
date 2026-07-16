package com.fusion.fusion.sinistro;

import java.time.LocalDateTime;

public record SpeedEventEntry(

        LocalDateTime dateTime,

        Double speed,

        Double limit,

        String address

) {
}
