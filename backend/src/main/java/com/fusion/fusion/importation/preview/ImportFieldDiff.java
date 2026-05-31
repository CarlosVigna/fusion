package com.fusion.fusion.importation.preview;

public record ImportFieldDiff(

        String field,

        String currentValue,

        String newValue

) {
}