package com.fusion.fusion.vehicle.multiportal.operational;

import java.util.List;

public record OperationalUpdateResponse(

        Integer updatedVehicles,

        Integer notFoundVehicles,

        List<String> notFoundPlates

) {
}