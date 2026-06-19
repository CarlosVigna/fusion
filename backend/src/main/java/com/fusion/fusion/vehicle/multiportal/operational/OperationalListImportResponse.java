package com.fusion.fusion.vehicle.multiportal.operational;

import java.util.List;

public record OperationalListImportResponse(

        Integer updatedVehicles,

        Integer notFoundVehicles,

        List<String> notFoundPlates

) {
}
