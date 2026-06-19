package com.fusion.fusion.vehicle.multiportal.operational;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class OperationalParserService {

    private static final Pattern PLATE_PATTERN =
            Pattern.compile("^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$");

    private static final Pattern QTD_VEIC_PATTERN =
            Pattern.compile("(?i)Qtd\\.?\\s*Veic");

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    public List<VehicleOperationalData> parse(String rawContent) {

        List<VehicleOperationalData> vehicles = new ArrayList<>();

        String[] lines = rawContent.split("\\r?\\n");

        for (int i = 0; i < lines.length; i++) {

            String line = lines[i]
                    .trim()
                    .replace("\t", "");

            if (!PLATE_PATTERN.matcher(line).matches()) {
                continue;
            }

            try {

                String plate = line;

                String dateLine = lines[i + 1].trim();

                String batteryLine = lines[i + 2]
                        .replace("%", "")
                        .trim();

                String insuredName = findInsuredName(lines, i);

                VehicleOperationalData vehicle =
                        VehicleOperationalData.builder()
                                .plate(plate)
                                .insuredName(insuredName)
                                .lastUpdateAt(
                                        LocalDateTime.parse(
                                                dateLine,
                                                FORMATTER
                                        )
                                )
                                .batteryLevel(
                                        Integer.parseInt(batteryLine)
                                )
                                .build();

                vehicles.add(vehicle);

            } catch (Exception ignored) {
            }

        }

        return vehicles;

    }

    private String findInsuredName(String[] lines, int plateLineIndex) {

        for (int i = plateLineIndex - 1; i >= 0; i--) {

            String line = lines[i].trim();

            if (line.isBlank()) {
                continue;
            }

            if (QTD_VEIC_PATTERN.matcher(line).find()) {

                return line.split("\t")[0].trim();

            }

            // chegou em outro bloco sem achar o cabeçalho do segurado
            if (PLATE_PATTERN.matcher(
                    line.replace("\t", "")
            ).matches()) {
                return null;
            }

        }

        return null;

    }

}