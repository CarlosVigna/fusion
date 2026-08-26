package com.fusion.fusion.vehicle.portal;

import java.util.List;

public record VehiclePortalSyncSummary(
        int vehiclesChecked,
        int vehiclesWithDiff,
        int diffsCreated,
        List<String> fieldsChanged
) {}
