package com.fusion.fusion.vehicle;

import java.util.List;

public final class PlateValidator {

    private static final List<String> INVALID_PLATE_PREFIXES = List.of(
            "LINKS", "TESTE", "COMBURIU", "CURITIBA", "FRANCK",
            "MARCELO", "NATAL", "PELOTAS", "RIOPRETO", "ABC0707", "TOTAL"
    );

    // Placas de teste conhecidas que não seguem nenhum prefixo bloqueável
    // de forma segura (ex.: "ITU0202" — "ITU" sozinho colidiria com
    // placas reais de veículos legítimos).
    private static final List<String> INVALID_EXACT_PLATES = List.of(
            "ITU0202"
    );

    private PlateValidator() {
    }

    public static boolean isValidPlate(String plate) {

        if (plate == null || plate.isBlank()) {
            return false;
        }

        String upper = plate.toUpperCase();

        // Placas reais só têm letras e números — qualquer outro
        // caractere (":", espaço, etc.) indica lixo de planilha, como
        // uma linha de rodapé/total ("TOTAL:516").
        if (!upper.matches("[A-Z0-9]+")) {
            return false;
        }

        if (INVALID_EXACT_PLATES.contains(upper)) {
            return false;
        }

        return INVALID_PLATE_PREFIXES.stream()
                .noneMatch(upper::startsWith);

    }

}
