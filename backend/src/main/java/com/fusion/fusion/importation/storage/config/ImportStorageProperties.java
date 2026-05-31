package com.fusion.fusion.importation.storage.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "fusion.imports")
public class ImportStorageProperties {

    private String root = "imports";

    private Integer retention = 10;

}