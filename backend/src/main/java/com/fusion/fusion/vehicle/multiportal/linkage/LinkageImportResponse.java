package com.fusion.fusion.vehicle.multiportal.linkage;

public record LinkageImportResponse(

        Integer importedLinkages,

        Integer activeLinkages,

        Integer linkedVehicles,

        Integer updatedLinkages,

        Integer unchangedLinkages

) {
}