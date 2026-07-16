package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.sinistro.SinistroJobPayload;

public record EtlPollResponse(

        ImportType type,

        SinistroJobPayload sinistroJob

) {
}
