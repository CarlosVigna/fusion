package com.fusion.fusion.sinistro;

import java.time.LocalDate;
import java.util.UUID;

// Devolvido dentro de GET /etl/poll quando ha uma analise de Sinistro
// pendente — ao contrario dos outros tipos de import (recorrentes, sem
// parametro), cada analise tem placa/periodo proprios, entao nao cabe
// no EtlTriggerService (fila por ImportType, sem payload).
public record SinistroJobPayload(

        UUID id,

        String plate,

        LocalDate startDate,

        LocalDate endDate

) {
}
