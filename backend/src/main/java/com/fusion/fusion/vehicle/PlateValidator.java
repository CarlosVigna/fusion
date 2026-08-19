package com.fusion.fusion.vehicle;

import java.util.List;
import java.util.regex.Pattern;

public final class PlateValidator {

    // Formato antigo (ABC1234) e Mercosul (ABC1D23) — usado para decidir se
    // um veiculo recem-criado entra como OPERATIONAL (frota real) ou TEST
    // (placa fora do padrao, tipicamente lixo de planilha tipo
    // "CAMPFRANCK"/"JEFFLONDRINA" que passa pelo filtro de prefixos
    // conhecidos de isValidPlate() por nao começar com nenhum deles).
    private static final Pattern PLATE_OLD_FORMAT      = Pattern.compile("[A-Z]{3}[0-9]{4}");
    private static final Pattern PLATE_MERCOSUL_FORMAT = Pattern.compile("[A-Z]{3}[0-9][A-Z][0-9]{2}");

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

    // Diferente de isValidPlate() (que so descarta lixo conhecido de
    // planilha), este metodo exige o formato oficial de placa brasileira.
    public static boolean isStandardFormat(String plate) {

        if (plate == null || plate.isBlank()) {
            return false;
        }

        String upper = plate.toUpperCase();

        return PLATE_OLD_FORMAT.matcher(upper).matches()
                || PLATE_MERCOSUL_FORMAT.matcher(upper).matches();

    }

}
