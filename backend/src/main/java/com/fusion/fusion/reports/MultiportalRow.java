package com.fusion.fusion.reports;

import java.time.LocalDate;
import java.time.LocalTime;

public record MultiportalRow(

        int ordem,

        String plate,

        String numberStr,

        LocalDate lastCommunicationDate,

        LocalTime lastCommunicationTime,

        String status,

        String insuredName,

        String policyNumber,

        LocalDate policyEndDate,

        String cpfCnpj

) {
}
