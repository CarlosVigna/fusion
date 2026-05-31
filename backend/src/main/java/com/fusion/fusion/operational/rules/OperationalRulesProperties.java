package com.fusion.fusion.operational.rules;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "fusion.operational")
public class OperationalRulesProperties {

    private Integer delayedMinutes = 30;

    private Integer noCommunicationMinutes = 360;

    private Integer staleUpdateHours = 6;

    private Integer lowBatteryLevel = 20;

}