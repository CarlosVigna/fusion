package com.fusion.fusion.vehicle.multiportal.operational;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VehicleOperationalData {

    private String plate;

    private LocalDateTime lastUpdateAt;

    private Integer batteryLevel;

}