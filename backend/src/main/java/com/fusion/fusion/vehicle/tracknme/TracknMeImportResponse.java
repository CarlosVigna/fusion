package com.fusion.fusion.vehicle.tracknme;

import java.util.List;

public record TracknMeImportResponse(

        Integer updatedVehicles,

        Integer createdVehicles,

        Integer notFoundVehicles,

        List<String> notFoundPlates

) {
}