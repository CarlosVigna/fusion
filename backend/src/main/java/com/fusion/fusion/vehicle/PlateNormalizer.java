package com.fusion.fusion.vehicle;

public final class PlateNormalizer {

    private PlateNormalizer() {
    }

    public static String normalize(String plate) {

        if (plate == null) {
            return null;
        }

        return plate
                .replace("-", "")
                .replace(" ", "")
                .trim()
                .toUpperCase();

    }

}
