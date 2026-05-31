package com.fusion.fusion.importation.confirm;

import java.util.List;

public record ImportConfirmItem(

        String identifier,

        String action,

        List<String> fields

) {
}