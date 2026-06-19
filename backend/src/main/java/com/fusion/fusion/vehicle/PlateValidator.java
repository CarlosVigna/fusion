package com.fusion.fusion.vehicle;

import java.util.List;

public final class PlateValidator {

    private static final List<String> INVALID_PLATE_PREFIXES = List.of(
            "LINKS", "TESTE", "COMBURIU", "CURITIBA", "FRANCK",
            "MARCELO", "NATAL", "PELOTAS", "RIOPRETO", "ABC0707"
    );

    private PlateValidator() {
    }

    public static boolean isValidPlate(String plate) {

        if (plate == null || plate.isBlank()) {
            return false;
        }

        String upper = plate.toUpperCase();

        return INVALID_PLATE_PREFIXES.stream()
                .noneMatch(upper::startsWith);

    }

}
