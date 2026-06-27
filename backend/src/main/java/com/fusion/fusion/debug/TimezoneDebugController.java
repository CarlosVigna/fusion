package com.fusion.fusion.debug;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TimeZone;

@RestController
public class TimezoneDebugController {

    @GetMapping("/debug/timezone")
    public Map<String, String> timezone() {

        Map<String, String> info = new LinkedHashMap<>();

        info.put(
                "systemDefaultZone",
                TimeZone.getDefault().getID()
        );

        info.put(
                "userTimezone",
                System.getProperty("user.timezone")
        );

        info.put(
                "TZ_env",
                System.getenv("TZ")
        );

        info.put(
                "JAVA_TOOL_OPTIONS",
                System.getenv("JAVA_TOOL_OPTIONS")
        );

        info.put(
                "now_java",
                LocalDateTime.now().toString()
        );

        info.put(
                "now_utc",
                LocalDateTime.now(ZoneOffset.UTC).toString()
        );

        info.put(
                "instant_now",
                Instant.now().toString()
        );

        return info;

    }

}
